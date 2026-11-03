-- Server-only synthetic workflow. These RPCs do not provide a public/authenticated app API.
begin;
alter table public.patients add column demo_key text unique, add column diagnosis_label text, add column initials text;
update public.patients p set demo_key=v.key,diagnosis_label=v.diagnosis,initials=v.initials from (values
 ('10000000-0000-4000-8000-000000000001'::uuid,'demo-ramesh','Oral cancer','RK'),
 ('10000000-0000-4000-8000-000000000002'::uuid,'demo-lakshmi','Breast cancer','LS'),
 ('10000000-0000-4000-8000-000000000003'::uuid,'demo-fatima','Cervical cancer','FA'),
 ('10000000-0000-4000-8000-000000000004'::uuid,'demo-suresh','Lung cancer','SP'),
 ('10000000-0000-4000-8000-000000000005'::uuid,'demo-meena','Breast cancer','MR')
) as v(id,key,diagnosis,initials) where p.id=v.id and p.synthetic=true;
alter table public.alerts add column request_id uuid unique, add column request_fingerprint text,
 add column last_escalated_at timestamptz not null default now(),add column escalation_exhausted boolean not null default false;
alter table public.alerts add constraint demo_request_pair check((request_id is null and request_fingerprint is null) or (request_id is not null and request_fingerprint ~ '^[a-f0-9]{64}$'));

create function public.saathi_demo_record(target uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',a.id,'patientId',p.demo_key,'requestId',a.request_id,'fingerprint',a.request_fingerprint,
 'createdAt',a.created_at,'status',a.status,'revision',a.revision,'escalationLevel',a.escalation_level,
 'lastEscalatedAt',a.last_escalated_at,'exhausted',a.escalation_exhausted,'report',a.trace_json,
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'at',e.at,'type',e.event,
   'actor',coalesce(m.name,'Demo system'),'details',e.details_json->>'text') order by e.at,e.id)
   from public.alert_events e left join public.care_team_members m on m.id=e.actor where e.alert_id=a.id),'[]'::jsonb))
 from public.alerts a join public.patients p on p.id=a.patient_id
 where a.id=target and a.request_id is not null and p.synthetic and p.demo_key is not null;
$$;

create function public.saathi_demo_queue() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('version',1,'storage','supabase',
 'patients',(select coalesce(jsonb_agg(jsonb_build_object('id',p.demo_key,'name',p.display_name,'age',p.age,
 'language',case p.language when 'hi' then 'Hindi' when 'kn' then 'Kannada' else 'English' end,
 'diagnosis',p.diagnosis_label,'initials',p.initials) order by p.demo_key),'[]'::jsonb) from public.patients p where p.synthetic and p.demo_key is not null),
 'team',(select coalesce(jsonb_agg(m.name order by m.on_call_order),'[]'::jsonb) from public.care_team_members m where m.id in
 ('20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000003'::uuid)),
 'records',(select coalesce(jsonb_agg(public.saathi_demo_record(a.id) order by a.created_at,a.id),'[]'::jsonb)
 from public.alerts a join public.patients p on p.id=a.patient_id where a.request_id is not null and p.synthetic and p.demo_key is not null));
$$;

create function public.saathi_demo_submit(p_request_id uuid,p_patient_key text,p_fingerprint text,p_report jsonb,p_protocol jsonb)
 returns jsonb language plpgsql set search_path='' as $$
declare patient uuid;existing public.alerts;protocol uuid;message uuid;checkin uuid;alert uuid;
begin
 -- Serialize duplicate request IDs across app instances; no process-local locking.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into existing from public.alerts where request_id=p_request_id;
 if found then
  if existing.request_fingerprint is distinct from p_fingerprint or not exists(select 1 from public.patients where id=existing.patient_id and demo_key=p_patient_key and synthetic) then
   raise exception 'Request ID conflict' using errcode='40001';end if;
  return jsonb_build_object('record',public.saathi_demo_record(existing.id),'duplicate',true);
 end if;
 select id into patient from public.patients where demo_key=p_patient_key and synthetic=true and pack='adult';
 if patient is null then raise exception 'Unknown synthetic adult patient' using errcode='P0002';end if;
 if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or p_report#>>'{evaluation,mode}' is distinct from 'demo_only'
  or p_report#>>'{input,context,pack}' is distinct from 'adult' or p_protocol->>'status' is distinct from 'demo_only'
  or p_report#>>'{evaluation,protocolVersion}' is distinct from p_protocol->>'version'
  or jsonb_typeof(p_report#>'{input,messages}') is distinct from 'array' then
  raise exception 'Invalid demo report' using errcode='22023';end if;
 insert into public.protocol_versions(version,pack,rules_json,status) values(p_protocol->>'version','adult',p_protocol,'demo_only') on conflict(version) do nothing;
 select id into protocol from public.protocol_versions where version=p_protocol->>'version' and rules_json=p_protocol and status='demo_only';
 if protocol is null then raise exception 'Protocol version content conflict' using errcode='40001';end if;
 insert into public.messages(patient_id,channel,external_id,body) values(patient,'local',p_request_id::text,
   coalesce((select string_agg(value->>'text',E'\n' order by ord) from jsonb_array_elements(p_report#>'{input,messages}') with ordinality as m(value,ord)),'')) returning id into message;
 insert into public.checkins(patient_id,message_id,fields_json) values(patient,message,p_report#>'{input,fields}') returning id into checkin;
 insert into public.alerts(patient_id,checkin_id,protocol_version_id,tier,evaluation_status,matched_rules,trace_json,request_id,request_fingerprint)
 values(patient,checkin,protocol,p_report#>>'{evaluation,tier}',p_report#>>'{evaluation,status}',
  array(select jsonb_array_elements_text(p_report#>'{evaluation,matched}')),p_report,p_request_id,p_fingerprint) returning id into alert;
 insert into public.alert_events(alert_id,event,details_json) values(alert,'created',jsonb_build_object('text',
   'Synthetic report saved to Supabase; tier '||coalesce(p_report#>>'{evaluation,tier}','pending')||'. External notifications disabled.'));
 return jsonb_build_object('record',public.saathi_demo_record(alert),'duplicate',false);
end;
$$;

create function public.saathi_demo_transition(target uuid,action text,expected_revision integer) returns jsonb
 language plpgsql set search_path='' as $$
declare a public.alerts;member constant uuid:='20000000-0000-4000-8000-000000000001';
begin
 select * into a from public.alerts where id=target and request_id is not null for update;
 if not found or not exists(select 1 from public.patients where id=a.patient_id and synthetic and demo_key is not null) then
  raise exception 'Synthetic report not found' using errcode='P0002';end if;
 if a.revision is distinct from expected_revision then raise exception 'Revision conflict' using errcode='40001';end if;
 if action='acknowledge' and a.status='open' then
  update public.alerts set status='acked',acked_by=member,acked_at=now(),revision=revision+1 where id=target;
 elsif action='resolve' and a.status='acked' then
  update public.alerts set status='resolved',revision=revision+1 where id=target;
 else raise exception 'Invalid status transition' using errcode='22023';end if;
 insert into public.alert_events(alert_id,event,actor,details_json) values(target,case action when 'acknowledge' then 'acknowledged' else 'resolved' end,member,
  jsonb_build_object('text','Status changed by simulated Demo doctor 1.','revision',expected_revision+1));
 return public.saathi_demo_record(target);
end;
$$;

create function public.saathi_demo_tick() returns jsonb language plpgsql set search_path='' as $$
declare a public.alerts;changed integer:=0;event_name text;message text;
begin
 for a in select al.* from public.alerts al join public.patients p on p.id=al.patient_id where al.request_id is not null
  and p.synthetic and p.demo_key is not null and al.tier='RED' and al.status='open' and not al.escalation_exhausted
  and al.last_escalated_at<=now()-interval '15 minutes' for update of al skip locked
 loop
  if a.escalation_level<2 then
   update public.alerts set escalation_level=escalation_level+1,last_escalated_at=now(),revision=revision+1 where id=a.id;
   event_name:='escalated';message:=case a.escalation_level when 0 then 'Demo escalation to Demo doctor 2; no notification sent.' else 'Demo escalation to Demo coordinator; no notification sent.' end;
  else
   update public.alerts set escalation_exhausted=true,last_escalated_at=now(),revision=revision+1 where id=a.id;
   event_name:='escalation_exhausted';message:='All demo escalation contacts reached. Remains open for human review.';
  end if;
  insert into public.alert_events(alert_id,event,details_json) values(a.id,event_name,jsonb_build_object('text',message));changed:=changed+1;
 end loop;
 return jsonb_build_object('changed',changed);
end;
$$;

-- One-time copy of validated synthetic local history; never changes an existing cloud report.
create function public.saathi_demo_import(p_record jsonb,p_protocol jsonb) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;target uuid;member uuid;ack_time timestamptz;e jsonb;actor_id uuid;
begin
 if p_record->>'status' not in ('open','acked','resolved') or jsonb_typeof(p_record->'events') is distinct from 'array'
  or (p_record->>'revision')::integer<1 or (p_record->>'escalationLevel')::integer not between 0 and 2 then
  raise exception 'Invalid local import' using errcode='22023';end if;
 result:=public.saathi_demo_submit((p_record->>'requestId')::uuid,p_record->>'patientId',p_record->>'fingerprint',p_record->'report',p_protocol);
 if (result->>'duplicate')::boolean then return result;end if;
 target:=(result#>>'{record,id}')::uuid;
 member:='20000000-0000-4000-8000-000000000001'::uuid;
 select (value->>'at')::timestamptz into ack_time from jsonb_array_elements(p_record->'events') where value->>'type'='acknowledged' limit 1;
 if p_record->>'status'<>'open' and ack_time is null then raise exception 'Import requires acknowledgement evidence' using errcode='22023';end if;
 -- Only the just-created, uncommitted placeholder event is replaced.
 delete from public.alert_events where alert_id=target;
 update public.alerts set id=(p_record->>'id')::uuid,created_at=(p_record->>'createdAt')::timestamptz,
  status=p_record->>'status',revision=(p_record->>'revision')::integer,escalation_level=(p_record->>'escalationLevel')::integer,
  last_escalated_at=(p_record->>'lastEscalatedAt')::timestamptz,escalation_exhausted=(p_record->>'exhausted')::boolean,
  acked_by=case when p_record->>'status'='open' then null else member end,acked_at=ack_time where id=target;
 target:=(p_record->>'id')::uuid;
 for e in select value from jsonb_array_elements(p_record->'events') loop
  if e->>'type' not in ('created','acknowledged','resolved','escalated','escalation_exhausted') then raise exception 'Invalid imported event' using errcode='22023';end if;
  actor_id:=null;
  if e->>'actor'<>'Demo system' then
   select id into actor_id from public.care_team_members where name=e->>'actor' and id in
    ('20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000003'::uuid);
   if actor_id is null then raise exception 'Unknown imported actor' using errcode='22023';end if;
  end if;
  insert into public.alert_events(id,alert_id,event,actor,details_json,at)
   values((e->>'id')::uuid,target,e->>'type',actor_id,jsonb_build_object('text',e->>'details'),(e->>'at')::timestamptz);
 end loop;
 insert into public.alert_events(alert_id,event,details_json) values(target,'imported',jsonb_build_object('text','Copied from the validated synthetic local demo; original history retained.'));
 return jsonb_build_object('record',public.saathi_demo_record(target),'duplicate',false);
end;
$$;

-- Explicit revokes also remove Supabase's direct default grants.
revoke all on function public.saathi_demo_record(uuid),public.saathi_demo_queue(),public.saathi_demo_submit(uuid,text,text,jsonb,jsonb),
 public.saathi_demo_transition(uuid,text,integer),public.saathi_demo_tick(),public.saathi_demo_import(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.saathi_demo_record(uuid),public.saathi_demo_queue(),public.saathi_demo_submit(uuid,text,text,jsonb,jsonb),
 public.saathi_demo_transition(uuid,text,integer),public.saathi_demo_tick(),public.saathi_demo_import(jsonb,jsonb) to service_role;
commit;
