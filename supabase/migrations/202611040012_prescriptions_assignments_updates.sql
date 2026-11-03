begin;
-- Dr. Rao's call (3 Nov): AMBER and GREEN calls are assigned to a doctor, nurse or psychologist; after a teleconsult the
-- doctor may issue a signed prescription (restricted drugs blocked by the app); families report daily pain scores and
-- hospital admissions or discharges between calls.
create table if not exists public.saathi_assignments(
 alert_id uuid primary key references public.alerts(id) on delete cascade,
 assignee text not null check (assignee in ('doctor','nurse','psychologist')),
 assigned_by text not null check (char_length(assigned_by) between 1 and 80),
 assigned_at timestamptz not null default now()
);
create table if not exists public.saathi_care_events(
 id bigint generated always as identity primary key,
 patient_id uuid not null references public.patients(id) on delete cascade,
 kind text not null check (kind in ('pain','admitted','discharged')),
 value integer check (value is null or value between 0 and 10),
 note text check (note is null or char_length(note)<=300),
 source text not null check (source in ('web','whatsapp','staff')),
 reported_at timestamptz not null default now(),
 check ((kind='pain')=(value is not null))
);
create table if not exists public.saathi_prescriptions(
 id uuid primary key default gen_random_uuid(),
 alert_id uuid references public.alerts(id) on delete set null,
 patient_id uuid not null references public.patients(id) on delete cascade,
 prescriber text not null check (char_length(prescriber) between 1 and 80),
 registration text not null check (char_length(registration) between 3 and 40),
 items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 10),
 advice text check (advice is null or char_length(advice)<=1000),
 signature text not null check (signature ~ '^[A-Za-z0-9_-]{43}$'),
 issued_at timestamptz not null default now()
);
alter table public.saathi_assignments enable row level security;
alter table public.saathi_care_events enable row level security;
alter table public.saathi_prescriptions enable row level security;
revoke all on public.saathi_assignments,public.saathi_care_events,public.saathi_prescriptions from public,anon,authenticated;
grant all on public.saathi_assignments,public.saathi_care_events,public.saathi_prescriptions to service_role;
revoke all on sequence public.saathi_care_events_id_seq from public,anon,authenticated;
grant usage,select on sequence public.saathi_care_events_id_seq to service_role;

create or replace function public.saathi_demo_assign(target uuid,p_assignee text,p_by text) returns jsonb language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.alerts a join public.patients p on p.id=a.patient_id where a.id=target and p.synthetic) then raise exception 'Synthetic report not found' using errcode='P0002';end if;
 insert into public.saathi_assignments(alert_id,assignee,assigned_by) values(target,p_assignee,left(btrim(p_by),80))
 on conflict (alert_id) do update set assignee=excluded.assignee,assigned_by=excluded.assigned_by,assigned_at=now();
 return jsonb_build_object('assignee',p_assignee,'by',left(btrim(p_by),80),'at',now());
end;$$;
create or replace function public.saathi_demo_assignments() returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_object_agg(alert_id,jsonb_build_object('assignee',assignee,'by',assigned_by,'at',assigned_at)),'{}'::jsonb) from public.saathi_assignments;
$$;
create or replace function public.saathi_demo_care_event(p_patient_key text,p_kind text,p_value integer,p_note text,p_source text) returns jsonb language plpgsql set search_path='' as $$
declare pid uuid;r public.saathi_care_events;
begin
 select id into pid from public.patients where demo_key=p_patient_key and synthetic;if pid is null then raise exception 'Synthetic patient not found' using errcode='P0002';end if;
 insert into public.saathi_care_events(patient_id,kind,value,note,source) values(pid,p_kind,p_value,nullif(btrim(coalesce(p_note,'')),''),p_source) returning * into r;
 return jsonb_build_object('kind',r.kind,'value',r.value,'note',r.note,'source',r.source,'at',r.reported_at);
end;$$;
create or replace function public.saathi_demo_care_events(p_patient_key text) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('kind',e.kind,'value',e.value,'note',e.note,'source',e.source,'at',e.reported_at) order by e.reported_at),'[]'::jsonb)
 from public.saathi_care_events e join public.patients p on p.id=e.patient_id where p.demo_key=p_patient_key and p.synthetic;
$$;
create or replace function public.saathi_demo_prescribe(p_patient_key text,p_alert uuid,p_prescriber text,p_registration text,p_items jsonb,p_advice text,p_signature text,p_id uuid,p_issued timestamptz) returns jsonb language plpgsql set search_path='' as $$
declare pid uuid;
begin
 select id into pid from public.patients where demo_key=p_patient_key and synthetic;if pid is null then raise exception 'Synthetic patient not found' using errcode='P0002';end if;
 if p_alert is not null and not exists(select 1 from public.alerts where id=p_alert and patient_id=pid) then raise exception 'Report does not belong to this patient' using errcode='22023';end if;
 insert into public.saathi_prescriptions(id,alert_id,patient_id,prescriber,registration,items,advice,signature,issued_at) values(p_id,p_alert,pid,btrim(p_prescriber),btrim(p_registration),p_items,nullif(btrim(coalesce(p_advice,'')),''),p_signature,p_issued);
 return jsonb_build_object('id',p_id);
end;$$;
create or replace function public.saathi_demo_prescriptions(p_patient_key text) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'alertId',r.alert_id,'patientId',p.demo_key,'prescriber',r.prescriber,'registration',r.registration,'items',r.items,'advice',r.advice,'signature',r.signature,'issuedAt',r.issued_at) order by r.issued_at desc),'[]'::jsonb)
 from public.saathi_prescriptions r join public.patients p on p.id=r.patient_id where (p_patient_key is null or p.demo_key=p_patient_key) and p.synthetic;
$$;
revoke all on function public.saathi_demo_assign(uuid,text,text),public.saathi_demo_assignments(),public.saathi_demo_care_event(text,text,integer,text,text),public.saathi_demo_care_events(text),
 public.saathi_demo_prescribe(text,uuid,text,text,jsonb,text,text,uuid,timestamptz),public.saathi_demo_prescriptions(text) from public,anon,authenticated;
grant execute on function public.saathi_demo_assign(uuid,text,text),public.saathi_demo_assignments(),public.saathi_demo_care_event(text,text,integer,text,text),public.saathi_demo_care_events(text),
 public.saathi_demo_prescribe(text,uuid,text,text,jsonb,text,text,uuid,timestamptz),public.saathi_demo_prescriptions(text) to service_role;
commit;
