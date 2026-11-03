-- Teleconsult workflow from the clinical lead's 3 Nov direction: closing a call records call notes and advice,
-- "Check in to Saathi" stores a synthetic care plan from the demo EMR, reminder taps log doses, and fees are tracked.
begin;
create table public.saathi_care_plans(patient_id uuid primary key references public.patients(id) on delete cascade,plan jsonb not null,source text not null check(source='demo_emr'),checked_in_at timestamptz not null default now());
create table public.saathi_dose_logs(id bigint generated always as identity primary key,patient_id uuid not null references public.patients(id) on delete cascade,dose_key text not null check(dose_key ~ '^[a-z0-9_-]{1,40}$'),due_date date not null,slot text not null check(slot in ('morning','afternoon','evening','night')),status text not null check(status in ('given','not_given')),source text not null check(source in ('whatsapp','web')),reported_at timestamptz not null default now(),unique(patient_id,dose_key,due_date,slot));
create table public.saathi_fees(alert_id uuid primary key references public.alerts(id) on delete cascade,status text not null check(status in ('due','paid','waived')),updated_at timestamptz not null default now());
alter table public.saathi_care_plans enable row level security;
alter table public.saathi_dose_logs enable row level security;
alter table public.saathi_fees enable row level security;
revoke all on public.saathi_care_plans,public.saathi_dose_logs,public.saathi_fees from public,anon,authenticated;
grant all on public.saathi_care_plans,public.saathi_dose_logs,public.saathi_fees to service_role;
revoke all on sequence public.saathi_dose_logs_id_seq from public,anon,authenticated;
grant usage,select on sequence public.saathi_dose_logs_id_seq to service_role;

create function public.saathi_demo_patient(p_patient_key text) returns uuid language plpgsql stable set search_path='' as $$
declare target uuid;
begin
 select id into target from public.patients where demo_key=p_patient_key and synthetic;
 if target is null then raise exception 'Synthetic patient not found' using errcode='P0002';end if;
 return target;
end;
$$;

create function public.saathi_demo_close(target uuid,expected_revision integer,p_notes text,p_advice text) returns jsonb language plpgsql set search_path='' as $$
declare a public.alerts;member constant uuid:='20000000-0000-4000-8000-000000000001';
begin
 if length(btrim(coalesce(p_notes,'')))=0 or length(p_notes)>4000 or length(coalesce(p_advice,''))>2000 then raise exception 'Call notes are required (up to 4000 characters)' using errcode='22023';end if;
 select * into a from public.alerts where id=target and request_id is not null for update;
 if not found or not exists(select 1 from public.patients where id=a.patient_id and synthetic and demo_key is not null) then raise exception 'Synthetic report not found' using errcode='P0002';end if;
 if a.revision is distinct from expected_revision then raise exception 'Revision conflict' using errcode='PT409';end if;
 if a.status<>'acked' then raise exception 'Acknowledge the report before closing the call' using errcode='22023';end if;
 update public.alerts set status='resolved',revision=revision+1 where id=target;
 insert into public.alert_events(alert_id,event,actor,details_json) values(target,'resolved',member,jsonb_build_object(
  'text','Call completed by simulated Demo doctor 1. Call notes: '||btrim(p_notes)||coalesce(nullif(' Advice given: '||btrim(coalesce(p_advice,'')),' Advice given: '),''),
  'notes',btrim(p_notes),'advice',nullif(btrim(coalesce(p_advice,'')),''),'revision',expected_revision+1));
 return public.saathi_demo_record(target);
end;
$$;

create function public.saathi_demo_checkin(p_patient_key text,p_plan jsonb) returns jsonb language plpgsql set search_path='' as $$
declare target uuid:=public.saathi_demo_patient(p_patient_key);row public.saathi_care_plans;
begin
 if jsonb_typeof(p_plan) is distinct from 'object' or length(p_plan::text)>20000 then raise exception 'Invalid care plan' using errcode='22023';end if;
 insert into public.saathi_care_plans(patient_id,plan,source) values(target,p_plan,'demo_emr')
  on conflict(patient_id) do update set plan=excluded.plan,checked_in_at=now() returning * into row;
 return jsonb_build_object('patientId',p_patient_key,'plan',row.plan,'checkedInAt',row.checked_in_at);
end;
$$;

create function public.saathi_demo_care_plans() returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_object_agg(p.demo_key,jsonb_build_object('plan',c.plan,'checkedInAt',c.checked_in_at)),'{}'::jsonb)
 from public.saathi_care_plans c join public.patients p on p.id=c.patient_id where p.synthetic and p.demo_key is not null;
$$;

create function public.saathi_demo_log_dose(p_patient_key text,p_dose_key text,p_due date,p_slot text,p_status text,p_source text) returns jsonb language plpgsql set search_path='' as $$
declare target uuid:=public.saathi_demo_patient(p_patient_key);
begin
 if p_due>current_date+1 or p_due<current_date-31 then raise exception 'Dose date out of range' using errcode='22023';end if;
 insert into public.saathi_dose_logs(patient_id,dose_key,due_date,slot,status,source) values(target,p_dose_key,p_due,p_slot,p_status,p_source)
  on conflict(patient_id,dose_key,due_date,slot) do update set status=excluded.status,source=excluded.source,reported_at=now();
 return jsonb_build_object('doseKey',p_dose_key,'dueDate',p_due,'slot',p_slot,'status',p_status);
end;
$$;

create function public.saathi_demo_dose_logs(p_patient_key text) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('doseKey',d.dose_key,'dueDate',d.due_date,'slot',d.slot,'status',d.status,'reportedAt',d.reported_at) order by d.due_date,d.slot,d.dose_key),'[]'::jsonb)
 from public.saathi_dose_logs d where d.patient_id=public.saathi_demo_patient(p_patient_key);
$$;

create function public.saathi_demo_set_fee(target uuid,p_status text) returns jsonb language plpgsql set search_path='' as $$
begin
 if p_status not in ('due','paid','waived') then raise exception 'Invalid fee status' using errcode='22023';end if;
 if not exists(select 1 from public.alerts a join public.patients p on p.id=a.patient_id where a.id=target and a.request_id is not null and p.synthetic) then raise exception 'Synthetic report not found' using errcode='P0002';end if;
 insert into public.saathi_fees(alert_id,status) values(target,p_status) on conflict(alert_id) do update set status=excluded.status,updated_at=now();
 return jsonb_build_object('id',target,'status',p_status);
end;
$$;

create function public.saathi_demo_fees() returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_object_agg(f.alert_id::text,f.status),'{}'::jsonb) from public.saathi_fees f;
$$;

revoke all on function public.saathi_demo_patient(text),public.saathi_demo_close(uuid,integer,text,text),public.saathi_demo_checkin(text,jsonb),public.saathi_demo_care_plans(),public.saathi_demo_log_dose(text,text,date,text,text,text),public.saathi_demo_dose_logs(text),public.saathi_demo_set_fee(uuid,text),public.saathi_demo_fees() from public,anon,authenticated;
grant execute on function public.saathi_demo_patient(text),public.saathi_demo_close(uuid,integer,text,text),public.saathi_demo_checkin(text,jsonb),public.saathi_demo_care_plans(),public.saathi_demo_log_dose(text,text,date,text,text,text),public.saathi_demo_dose_logs(text),public.saathi_demo_set_fee(uuid,text),public.saathi_demo_fees() to service_role;
commit;
