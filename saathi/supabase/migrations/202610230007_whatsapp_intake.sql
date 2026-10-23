-- Service-only inbox for the Meta-signed receiver and one local WhatsApp worker.
begin;
create table public.wa_demo_bindings(phone_id text not null,sender_id text not null,consented boolean not null,expires_at timestamptz not null,primary key(phone_id,sender_id));
create table public.wa_demo_inbox(id bigint generated always as identity primary key,phone_id text not null,message_id text not null,payload jsonb,received_at timestamptz not null default now(),processed_at timestamptz,unique(phone_id,message_id));
alter table public.wa_demo_bindings enable row level security;
alter table public.wa_demo_inbox enable row level security;
revoke all on public.wa_demo_bindings,public.wa_demo_inbox from public,anon,authenticated;
grant all on public.wa_demo_bindings,public.wa_demo_inbox to service_role;
revoke all on sequence public.wa_demo_inbox_id_seq from public,anon,authenticated;
grant usage,select on sequence public.wa_demo_inbox_id_seq to service_role;
create function public.saathi_wa_binding(p_phone text,p_sender text,p_consented boolean,p_expires timestamptz) returns void language plpgsql set search_path='' as $$
begin
 if p_phone !~ '^[0-9]{1,40}$' or p_sender !~ '^[0-9]{8,15}$' then raise exception 'Invalid channel binding' using errcode='22023';end if;
 if p_expires is null or p_expires<=now() then delete from public.wa_demo_bindings where phone_id=p_phone and sender_id=p_sender;return;end if;
 if p_expires>now()+interval '25 hours' then raise exception 'Invalid consent expiry' using errcode='22023';end if;
 insert into public.wa_demo_bindings values(p_phone,p_sender,p_consented,p_expires) on conflict(phone_id,sender_id) do update set consented=excluded.consented,expires_at=excluded.expires_at;
end;
$$;
create function public.saathi_wa_enqueue(p_phone text,p_messages jsonb) returns jsonb language plpgsql set search_path='' as $$
declare item jsonb;b public.wa_demo_bindings;n integer:=0;t numeric;allowed boolean;
begin
 if p_phone !~ '^[0-9]{1,40}$' or jsonb_typeof(p_messages) is distinct from 'array' or jsonb_array_length(p_messages)>100 then raise exception 'Invalid inbox batch' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(p_messages) loop
  if coalesce(item->>'id','') !~ '^wamid\.[A-Za-z0-9+/=_-]+$' or length(item->>'id')>506 or coalesce(item->>'from','') !~ '^[0-9]{8,15}$' or coalesce(item->>'timestamp','') !~ '^[0-9]{1,15}$' then continue;end if;
  t:=(item->>'timestamp')::numeric;if t<extract(epoch from now()-interval '24 hours') or t>extract(epoch from now()+interval '5 minutes') then continue;end if;
  select * into b from public.wa_demo_bindings where phone_id=p_phone and sender_id=item->>'from' and expires_at>now();
  allowed:=case when item->>'kind'='text' then coalesce(item->>'text','') ~ '^/start( [A-Za-z0-9_-]{32})?$' else false end;
  if b.sender_id is not null then allowed:=allowed or b.consented or item->>'kind'='button' or item->>'text'='/stop';end if;
  if not coalesce(allowed,false) or coalesce(item->>'kind','') not in ('text','voice','button') then continue;end if;
  insert into public.wa_demo_inbox(phone_id,message_id,payload) values(p_phone,item->>'id',item) on conflict(phone_id,message_id) do nothing;
  if found then n:=n+1;end if;
 end loop;
 return jsonb_build_object('accepted',n);
end;
$$;
create function public.saathi_wa_next(p_phone text,p_offset bigint) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('id',id,'message',payload) from public.wa_demo_inbox where phone_id=p_phone and id>=p_offset and payload is not null order by id limit 1;
$$;
create function public.saathi_wa_complete(p_phone text,p_offset bigint) returns void language sql set search_path='' as $$
 update public.wa_demo_inbox set payload=null,processed_at=now() where phone_id=p_phone and id<p_offset and payload is not null;
$$;
create function public.saathi_wa_submit(p_request_id uuid,p_patient_key text,p_fingerprint text,p_report jsonb,p_protocol jsonb) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;external text;target uuid;
begin
 external:=p_report#>>'{origin,externalId}';
 if p_report#>>'{origin,channel}' is distinct from 'whatsapp' or external is null or external !~ '^wamid\.[A-Za-z0-9+/=_-]+$' or length(external)>506 or coalesce(p_report->>'source','') not in ('voice','text','buttons') then raise exception 'Invalid WhatsApp provenance' using errcode='22023';end if;
 result:=public.saathi_demo_submit(p_request_id,p_patient_key,p_fingerprint,p_report,p_protocol);
 if result#>'{record,report,origin}' is distinct from p_report->'origin' then raise exception 'Request origin conflict' using errcode='PT409';end if;
 target:=(result#>>'{record,id}')::uuid;
 update public.messages set channel='whatsapp',external_id=external where id=(select message_id from public.checkins where id=(select checkin_id from public.alerts where id=target));return result;
end;
$$;
revoke all on function public.saathi_wa_binding(text,text,boolean,timestamptz),public.saathi_wa_enqueue(text,jsonb),public.saathi_wa_next(text,bigint),public.saathi_wa_complete(text,bigint),public.saathi_wa_submit(uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.saathi_wa_binding(text,text,boolean,timestamptz),public.saathi_wa_enqueue(text,jsonb),public.saathi_wa_next(text,bigint),public.saathi_wa_complete(text,bigint),public.saathi_wa_submit(uuid,text,text,jsonb,jsonb) to service_role;
commit;
