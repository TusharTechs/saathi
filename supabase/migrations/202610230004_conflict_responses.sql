-- Domain conflicts are HTTP 409, not retryable serialization failures.
begin;
create or replace function public.saathi_demo_submit(p_request_id uuid,p_patient_key text,p_fingerprint text,p_report jsonb,p_protocol jsonb)
 returns jsonb language plpgsql set search_path='' as $$
declare patient uuid;existing public.alerts;protocol uuid;message uuid;checkin uuid;alert uuid;
begin
 -- Serialize duplicate request IDs across app instances; no process-local locking.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into existing from public.alerts where request_id=p_request_id;
 if found then
  if existing.request_fingerprint is distinct from p_fingerprint or not exists(select 1 from public.patients where id=existing.patient_id and demo_key=p_patient_key and synthetic) then
   raise exception 'Request ID conflict' using errcode='PT409';end if;
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
 if protocol is null then raise exception 'Protocol version content conflict' using errcode='PT409';end if;
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

create or replace function public.saathi_demo_transition(target uuid,action text,expected_revision integer) returns jsonb
 language plpgsql set search_path='' as $$
declare a public.alerts;member constant uuid:='20000000-0000-4000-8000-000000000001';
begin
 select * into a from public.alerts where id=target and request_id is not null for update;
 if not found or not exists(select 1 from public.patients where id=a.patient_id and synthetic and demo_key is not null) then
  raise exception 'Synthetic report not found' using errcode='P0002';end if;
 if a.revision is distinct from expected_revision then raise exception 'Revision conflict' using errcode='PT409';end if;
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
revoke all on function public.saathi_demo_submit(uuid,text,text,jsonb,jsonb),public.saathi_demo_transition(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.saathi_demo_submit(uuid,text,text,jsonb,jsonb),public.saathi_demo_transition(uuid,text,integer) to service_role;
commit;
