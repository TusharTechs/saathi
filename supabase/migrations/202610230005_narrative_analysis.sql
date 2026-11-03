-- Durable extraction claims keep reports visible and prevent duplicate model jobs.
begin;
alter table public.alerts add column analysis_lease uuid,add column analysis_lease_until timestamptz;
create function public.saathi_demo_lookup(p_request_id uuid,p_fingerprint text) returns jsonb language plpgsql set search_path='' as $$
declare a public.alerts;
begin
 select * into a from public.alerts where request_id=p_request_id;
 if not found then return null;end if;
 if a.request_fingerprint is distinct from p_fingerprint then raise exception 'Request ID conflict' using errcode='PT409';end if;
 return public.saathi_demo_record(a.id);
end;
$$;
create function public.saathi_demo_claim_analysis(target uuid) returns jsonb language plpgsql set search_path='' as $$
declare a public.alerts;token uuid;
begin
 select * into a from public.alerts where id=target and request_id is not null for update;
 if not found or coalesce(a.trace_json->>'source','') not in ('voice','text') then raise exception 'Narrative report not found' using errcode='P0002';end if;
 if a.trace_json#>>'{processing,extraction,status}'='complete' or a.analysis_lease_until>now() then
  return jsonb_build_object('claimed',false,'record',public.saathi_demo_record(target));end if;
 token:=gen_random_uuid();
 update public.alerts set analysis_lease=token,analysis_lease_until=now()+interval '90 seconds',revision=revision+1,
 trace_json=jsonb_set(trace_json,'{processing,extraction}',jsonb_build_object('provider','groq','model','openai/gpt-oss-120b','status','pending')) where id=target;
 insert into public.alert_events(alert_id,event,details_json) values(target,'analysis_started',jsonb_build_object('text','Structured extraction started. Original report and keyword flags remain visible.'));
 return jsonb_build_object('claimed',true,'lease',token,'record',public.saathi_demo_record(target));
end;
$$;
create function public.saathi_demo_complete_analysis(target uuid,p_lease uuid,p_report jsonb) returns jsonb language plpgsql set search_path='' as $$
declare a public.alerts;new_tier text;old_rank integer;new_rank integer;higher boolean;failed boolean;
begin
 select * into a from public.alerts where id=target and request_id is not null for update;
 if not found then raise exception 'Report not found' using errcode='P0002';end if;
 if p_lease is null or a.analysis_lease is null or a.analysis_lease_until is null or a.analysis_lease is distinct from p_lease or a.analysis_lease_until<now() then raise exception 'Analysis lease conflict' using errcode='PT409';end if;
 if p_report#>>'{evaluation,mode}' is distinct from 'demo_only'
  or p_report#>>'{evaluation,protocolVersion}' is distinct from a.trace_json#>>'{evaluation,protocolVersion}'
  or p_report#>'{input,messages}' is distinct from a.trace_json#>'{input,messages}'
  or p_report#>'{input,context}' is distinct from a.trace_json#>'{input,context}'
  or p_report->>'source' is distinct from a.trace_json->>'source'
  or coalesce(p_report#>>'{processing,extraction,status}','') not in ('complete','failed') then
   raise exception 'Invalid analysis result' using errcode='22023';end if;
 new_tier:=p_report#>>'{evaluation,tier}';
 -- A model result cannot remove an already-raised RED. Narrative reports always need human review.
 if a.tier='RED' then new_tier:='RED';end if;
 if new_tier='GREEN' then new_tier:=null;end if;
 p_report:=jsonb_set(p_report,'{evaluation,tier}',coalesce(to_jsonb(new_tier),'null'::jsonb));
 p_report:=jsonb_set(p_report,'{evaluation,status}','"needs_followup"'::jsonb);
 p_report:=jsonb_set(p_report,'{needsTextReview}','true'::jsonb);
 -- Retain every previously raised reason, including the independent safety net.
 p_report:=jsonb_set(p_report,'{evaluation,matched}',coalesce((select jsonb_agg(value order by value) from
  (select distinct value from jsonb_array_elements_text(coalesce(p_report#>'{evaluation,matched}','[]'::jsonb)||coalesce(a.trace_json#>'{evaluation,matched}','[]'::jsonb))) s),'[]'::jsonb));
 old_rank:=case a.tier when 'RED' then 3 when 'AMBER' then 2 else 1 end;
 new_rank:=case new_tier when 'RED' then 3 when 'AMBER' then 2 else 1 end;
 higher:=new_rank>old_rank;failed:=p_report#>>'{processing,extraction,status}'='failed';
 update public.checkins set fields_json=p_report#>'{input,fields}',completed_at=now() where id=a.checkin_id;
 update public.alerts set trace_json=p_report,tier=new_tier,evaluation_status='needs_followup',
 matched_rules=array(select jsonb_array_elements_text(p_report#>'{evaluation,matched}')),
 revision=revision+1,analysis_lease=null,analysis_lease_until=null,
 status=case when higher then 'open' else status end,
 acked_by=case when higher then null else acked_by end,acked_at=case when higher then null else acked_at end,
 escalation_level=case when higher then 0 else escalation_level end,
 escalation_exhausted=case when higher then false else escalation_exhausted end,
 last_escalated_at=case when higher then now() else last_escalated_at end where id=target;
 insert into public.alert_events(alert_id,event,details_json) values(target,case when failed then 'analysis_failed' else 'analysis_completed' end,
  jsonb_build_object('text',case when failed then 'Extraction failed; transcript and keyword flags retained for human review.' else 'Structured observations validated against source quotes. Human review is still required.' end));
 if higher and a.status<>'open' then insert into public.alert_events(alert_id,event,details_json) values(target,'reopened',jsonb_build_object('text','Newly extracted observations raised the tier. Report reopened for review.'));end if;
 return public.saathi_demo_record(target);
end;
$$;
revoke all on function public.saathi_demo_lookup(uuid,text),public.saathi_demo_claim_analysis(uuid),public.saathi_demo_complete_analysis(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.saathi_demo_lookup(uuid,text),public.saathi_demo_claim_analysis(uuid),public.saathi_demo_complete_analysis(uuid,uuid,jsonb) to service_role;
commit;
