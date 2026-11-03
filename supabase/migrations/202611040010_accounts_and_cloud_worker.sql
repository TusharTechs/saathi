begin;
-- Saathi accounts: medical staff, call managers and families, signing in by email and password or a WhatsApp-verified mobile.
create table if not exists public.saathi_accounts(
 id uuid primary key default gen_random_uuid(),
 role text not null check (role in ('medical','coordinator','family')),
 name text not null check (char_length(btrim(name)) between 1 and 80),
 email text unique check (email is null or (email=lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
 phone text unique check (phone is null or phone ~ '^[0-9]{8,15}$'),
 password_hash text check (password_hash is null or password_hash like 'scrypt$%'),
 patient_key text,
 organisation text not null default 'demo-org',
 created_at timestamptz not null default now(),
 last_sign_in_at timestamptz,
 check (email is not null or phone is not null),
 check (email is null or password_hash is not null),
 check ((role='family')=(patient_key is not null))
);
-- WhatsApp login: the website shows a code; the person sends "LOGIN <code>" from their phone. Inbound messages are free.
create table if not exists public.saathi_login_challenges(
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[0-9]{6}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 verified_phone text check (verified_phone is null or verified_phone ~ '^[0-9]{8,15}$'),
 verified_at timestamptz,
 consumed_at timestamptz
);
-- WhatsApp worker state for the serverless worker (previously JSON files on one computer), with optimistic versions.
create table if not exists public.saathi_worker_state(key text primary key check (key ~ '^[a-z0-9:_-]{1,80}$'),doc jsonb not null,version bigint not null default 1,updated_at timestamptz not null default now());
create table if not exists public.saathi_worker_lease(name text primary key,holder uuid not null,expires_at timestamptz not null);
alter table public.saathi_accounts enable row level security;
alter table public.saathi_login_challenges enable row level security;
alter table public.saathi_worker_state enable row level security;
alter table public.saathi_worker_lease enable row level security;
revoke all on public.saathi_accounts,public.saathi_login_challenges,public.saathi_worker_state,public.saathi_worker_lease from public,anon,authenticated;
grant all on public.saathi_accounts,public.saathi_login_challenges,public.saathi_worker_state,public.saathi_worker_lease to service_role;

create or replace function public.saathi_account_create(p_role text,p_name text,p_email text,p_phone text,p_password_hash text,p_patient_key text,p_organisation text) returns jsonb language plpgsql set search_path='' as $$
declare r public.saathi_accounts;
begin
 if p_patient_key is not null and not exists(select 1 from public.patients where demo_key=p_patient_key and synthetic) then raise exception 'Synthetic patient not found' using errcode='P0002';end if;
 insert into public.saathi_accounts(role,name,email,phone,password_hash,patient_key,organisation,last_sign_in_at)
  values(p_role,btrim(p_name),nullif(lower(btrim(p_email)),''),nullif(p_phone,''),p_password_hash,p_patient_key,coalesce(p_organisation,'demo-org'),now()) returning * into r;
 return jsonb_build_object('id',r.id,'role',r.role,'name',r.name,'email',r.email,'phone',r.phone,'patientKey',r.patient_key);
end;$$;
create or replace function public.saathi_account_find(p_email text,p_phone text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',id,'role',role,'name',name,'email',email,'phone',phone,'patientKey',patient_key,'passwordHash',password_hash)
 from public.saathi_accounts where (p_email is not null and email=lower(btrim(p_email))) or (p_phone is not null and phone=p_phone) limit 1;
$$;
create or replace function public.saathi_account_touch(p_id uuid) returns void language sql set search_path='' as $$ update public.saathi_accounts set last_sign_in_at=now() where id=p_id; $$;

create or replace function public.saathi_login_challenge(p_code text,p_seconds integer) returns uuid language plpgsql set search_path='' as $$
declare v uuid;
begin
 delete from public.saathi_login_challenges where expires_at<now()-interval '1 day';
 insert into public.saathi_login_challenges(code,expires_at) values(p_code,now()+make_interval(secs=>least(greatest(p_seconds,60),900))) returning id into v;
 return v;
end;$$;
create or replace function public.saathi_login_status(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('verified',verified_phone is not null and consumed_at is null,'expired',expires_at<now(),'phone',case when consumed_at is null then verified_phone end)
 from public.saathi_login_challenges where id=p_id;
$$;
create or replace function public.saathi_login_consume(p_id uuid) returns text language plpgsql set search_path='' as $$
declare v text;
begin
 update public.saathi_login_challenges set consumed_at=now() where id=p_id and consumed_at is null and verified_phone is not null and expires_at>now()-interval '15 minutes' returning verified_phone into v;
 return v;
end;$$;
-- Called by the WhatsApp receiver before the consent filter: a "LOGIN 123456" text verifies the sender's number for that code.
create or replace function public.saathi_wa_login(p_messages jsonb) returns integer language plpgsql set search_path='' as $$
declare m jsonb;n integer:=0;c text;
begin
 for m in select * from jsonb_array_elements(coalesce(p_messages,'[]'::jsonb)) loop
  if m->>'kind'='text' and coalesce(m->>'from','') ~ '^[0-9]{8,15}$' then
   c:=substring(m->>'text' from '^\s*[Ll][Oo][Gg][Ii][Nn]\s+([0-9]{6})\s*$');
   if c is not null then
    update public.saathi_login_challenges set verified_phone=m->>'from',verified_at=now() where code=c and verified_phone is null and expires_at>now();
    if found then n:=n+1;end if;
   end if;
  end if;
 end loop;
 return n;
end;$$;

create or replace function public.saathi_worker_get(p_key text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('doc',doc,'version',version) from public.saathi_worker_state where key=p_key;
$$;
-- Writes only if nobody else wrote since the caller read version p_version (0 = the document must not exist yet).
create or replace function public.saathi_worker_put(p_key text,p_doc jsonb,p_version bigint) returns boolean language plpgsql set search_path='' as $$
begin
 if p_version=0 then
  insert into public.saathi_worker_state(key,doc) values(p_key,p_doc) on conflict (key) do nothing;return found;
 end if;
 update public.saathi_worker_state set doc=p_doc,version=version+1,updated_at=now() where key=p_key and version=p_version;return found;
end;$$;
create or replace function public.saathi_worker_acquire(p_name text,p_holder uuid,p_seconds integer) returns boolean language plpgsql set search_path='' as $$
begin
 insert into public.saathi_worker_lease(name,holder,expires_at) values(p_name,p_holder,now()+make_interval(secs=>p_seconds))
 on conflict (name) do update set holder=excluded.holder,expires_at=excluded.expires_at where public.saathi_worker_lease.expires_at<now() or public.saathi_worker_lease.holder=excluded.holder;
 return found;
end;$$;
create or replace function public.saathi_worker_release(p_name text,p_holder uuid) returns void language sql set search_path='' as $$ delete from public.saathi_worker_lease where name=p_name and holder=p_holder; $$;

-- The signed-in person's name now appears in the call log; the simulated team member remains the database actor.
create or replace function public.saathi_demo_record(target uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',a.id,'patientId',p.demo_key,'requestId',a.request_id,'fingerprint',a.request_fingerprint,
 'createdAt',a.created_at,'status',a.status,'revision',a.revision,'escalationLevel',a.escalation_level,
 'lastEscalatedAt',a.last_escalated_at,'exhausted',a.escalation_exhausted,'report',a.trace_json,
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'at',e.at,'type',e.event,
   'actor',coalesce(e.details_json->>'actorName',m.name,'Demo system'),'details',e.details_json->>'text') order by e.at,e.id)
   from public.alert_events e left join public.care_team_members m on m.id=e.actor where e.alert_id=a.id),'[]'::jsonb))
 from public.alerts a join public.patients p on p.id=a.patient_id
 where a.id=target and a.request_id is not null and p.synthetic and p.demo_key is not null;
$$;
create or replace function public.saathi_demo_transition_as(target uuid,action text,expected_revision integer,p_actor text) returns jsonb language plpgsql set search_path='' as $$
declare a public.alerts;member constant uuid:='20000000-0000-4000-8000-000000000001';who text:=left(btrim(coalesce(p_actor,'')),80);
begin
 if who='' then raise exception 'Actor required' using errcode='22023';end if;
 select * into a from public.alerts where id=target and request_id is not null for update;
 if not found or not exists(select 1 from public.patients where id=a.patient_id and synthetic and demo_key is not null) then raise exception 'Synthetic report not found' using errcode='P0002';end if;
 if a.revision is distinct from expected_revision then raise exception 'Revision conflict' using errcode='PT409';end if;
 if action='acknowledge' and a.status='open' then update public.alerts set status='acked',acked_by=member,acked_at=now(),revision=revision+1 where id=target;
 elsif action='resolve' and a.status='acked' then update public.alerts set status='resolved',revision=revision+1 where id=target;
 else raise exception 'Invalid status transition' using errcode='22023';end if;
 insert into public.alert_events(alert_id,event,actor,details_json) values(target,case action when 'acknowledge' then 'acknowledged' else 'resolved' end,member,
  jsonb_build_object('text',case action when 'acknowledge' then 'Accepted into the call-back list by '||who||'.' else 'Status changed by '||who||'.' end,'actorName',who,'revision',expected_revision+1));
 return public.saathi_demo_record(target);
end;$$;
create or replace function public.saathi_demo_close_as(target uuid,expected_revision integer,p_notes text,p_advice text,p_actor text) returns jsonb language plpgsql set search_path='' as $$
declare a public.alerts;member constant uuid:='20000000-0000-4000-8000-000000000001';who text:=left(btrim(coalesce(p_actor,'')),80);
begin
 if who='' then raise exception 'Actor required' using errcode='22023';end if;
 if length(btrim(coalesce(p_notes,'')))=0 or length(p_notes)>4000 or length(coalesce(p_advice,''))>2000 then raise exception 'Call notes are required (up to 4000 characters)' using errcode='22023';end if;
 select * into a from public.alerts where id=target and request_id is not null for update;
 if not found or not exists(select 1 from public.patients where id=a.patient_id and synthetic and demo_key is not null) then raise exception 'Synthetic report not found' using errcode='P0002';end if;
 if a.revision is distinct from expected_revision then raise exception 'Revision conflict' using errcode='PT409';end if;
 if a.status<>'acked' then raise exception 'Acknowledge the report before closing the call' using errcode='22023';end if;
 update public.alerts set status='resolved',revision=revision+1 where id=target;
 insert into public.alert_events(alert_id,event,actor,details_json) values(target,'resolved',member,jsonb_build_object(
  'text','Call completed by '||who||'. Call notes: '||btrim(p_notes)||coalesce(nullif(' Advice given: '||btrim(coalesce(p_advice,'')),' Advice given: '),''),
  'notes',btrim(p_notes),'advice',nullif(btrim(coalesce(p_advice,'')),''),'actorName',who,'revision',expected_revision+1));
 return public.saathi_demo_record(target);
end;$$;

revoke all on function public.saathi_account_create(text,text,text,text,text,text,text),public.saathi_account_find(text,text),public.saathi_account_touch(uuid),
 public.saathi_login_challenge(text,integer),public.saathi_login_status(uuid),public.saathi_login_consume(uuid),public.saathi_wa_login(jsonb),
 public.saathi_worker_get(text),public.saathi_worker_put(text,jsonb,bigint),public.saathi_worker_acquire(text,uuid,integer),public.saathi_worker_release(text,uuid),
 public.saathi_demo_record(uuid),public.saathi_demo_transition_as(uuid,text,integer,text),public.saathi_demo_close_as(uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.saathi_account_create(text,text,text,text,text,text,text),public.saathi_account_find(text,text),public.saathi_account_touch(uuid),
 public.saathi_login_challenge(text,integer),public.saathi_login_status(uuid),public.saathi_login_consume(uuid),public.saathi_wa_login(jsonb),
 public.saathi_worker_get(text),public.saathi_worker_put(text,jsonb,bigint),public.saathi_worker_acquire(text,uuid,integer),public.saathi_worker_release(text,uuid),
 public.saathi_demo_record(uuid),public.saathi_demo_transition_as(uuid,text,integer,text),public.saathi_demo_close_as(uuid,integer,text,text,text) to service_role;
commit;
