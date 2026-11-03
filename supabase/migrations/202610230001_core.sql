-- Core synthetic prototype schema. Local web app currently uses a file adapter.
-- Supabase supplies auth.users, auth.uid(), authenticated, anon and service_role.
begin;
create table public.care_team_members (
 id uuid primary key default gen_random_uuid(), auth_user_id uuid unique references auth.users(id),
 name text not null, role text not null check(role in ('doctor','nurse','coordinator')),
 on_call_order integer check(on_call_order>0)
);
create table public.patients (
 id uuid primary key default gen_random_uuid(), display_name text not null,
 age integer not null check(age>=0), pack text not null check(pack in ('adult','paediatric')),
 language text not null check(language in ('en','hi','kn')), synthetic boolean not null default true check(synthetic),
 created_at timestamptz not null default now()
);
create table public.patient_care_team (
 patient_id uuid references public.patients(id) on delete cascade,
 member_id uuid references public.care_team_members(id) on delete cascade,
 primary key(patient_id,member_id)
);
create table public.protocol_versions (
 id uuid primary key default gen_random_uuid(), version text unique not null, pack text not null check(pack in ('adult','paediatric')),
 rules_json jsonb not null, status text not null check(status in ('draft','demo_only','approved')),
 approved_by uuid references public.care_team_members(id),approved_at timestamptz,
 check((status='approved' and approved_by is not null and approved_at is not null) or
       (status<>'approved' and approved_by is null and approved_at is null))
);
create table public.messages (
 id uuid primary key default gen_random_uuid(),patient_id uuid not null references public.patients(id),
 channel text not null check(channel in ('local','telegram','whatsapp')),external_id text not null,
 body text not null,created_at timestamptz not null default now(), unique(channel,external_id),unique(id,patient_id)
);
create table public.checkins (
 id uuid primary key default gen_random_uuid(),patient_id uuid not null references public.patients(id),
 message_id uuid not null,fields_json jsonb not null,completed_at timestamptz not null default now(),
 foreign key(message_id,patient_id) references public.messages(id,patient_id),unique(id,patient_id),unique(message_id)
);
create table public.alerts (
 id uuid primary key default gen_random_uuid(),patient_id uuid not null references public.patients(id),
 checkin_id uuid not null unique,protocol_version_id uuid not null references public.protocol_versions(id),
 tier text check(tier in ('RED','AMBER','GREEN')),evaluation_status text not null check(evaluation_status in ('complete','needs_followup','unsupported_pack')),
 matched_rules text[] not null default '{}',trace_json jsonb not null,
 status text not null default 'open' check(status in ('open','acked','resolved')),
 revision integer not null default 1 check(revision>0),escalation_level integer not null default 0 check(escalation_level between 0 and 2),
 created_at timestamptz not null default now(),acked_by uuid references public.care_team_members(id),acked_at timestamptz,
 foreign key(checkin_id,patient_id) references public.checkins(id,patient_id),
 check(tier is not null or evaluation_status<>'complete'),
 check(tier is distinct from 'GREEN' or evaluation_status='complete'),
 check((status='open' and acked_by is null and acked_at is null) or (status<>'open' and acked_by is not null and acked_at is not null))
);
create table public.alert_events (
 id uuid primary key default gen_random_uuid(),alert_id uuid not null references public.alerts(id),
 event text not null,actor uuid references public.care_team_members(id),details_json jsonb not null default '{}',at timestamptz not null default now()
);
create index patient_care_team_member_idx on public.patient_care_team(member_id);
create index messages_patient_idx on public.messages(patient_id,created_at desc);
create index checkins_patient_idx on public.checkins(patient_id,completed_at desc);
create index alerts_queue_idx on public.alerts(status,tier,created_at);
create index alert_events_alert_idx on public.alert_events(alert_id,at);

-- SECURITY DEFINER avoids recursive policies on assignment and member tables.
-- It only exposes membership for the caller, not arbitrary member identities.
create function public.can_access_patient(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.patient_care_team a join public.care_team_members m on m.id=a.member_id where a.patient_id=target and m.auth_user_id=auth.uid());
$$;
revoke all on function public.can_access_patient(uuid) from public;
grant execute on function public.can_access_patient(uuid) to authenticated;

alter table public.patients enable row level security;
alter table public.patient_care_team enable row level security;
alter table public.care_team_members enable row level security;
alter table public.messages enable row level security;
alter table public.checkins enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;
alter table public.protocol_versions enable row level security;
create policy member_self on public.care_team_members for select to authenticated using(auth_user_id=auth.uid());
create policy assignments_scoped on public.patient_care_team for select to authenticated using(public.can_access_patient(patient_id));
create policy patients_scoped on public.patients for select to authenticated using(public.can_access_patient(id));
create policy messages_scoped on public.messages for select to authenticated using(public.can_access_patient(patient_id));
create policy checkins_scoped on public.checkins for select to authenticated using(public.can_access_patient(patient_id));
create policy alerts_scoped on public.alerts for select to authenticated using(public.can_access_patient(patient_id));
create policy events_scoped on public.alert_events for select to authenticated using(exists(select 1 from public.alerts a where a.id=alert_id and public.can_access_patient(a.patient_id)));
create policy protocols_visible on public.protocol_versions for select to authenticated using(exists(select 1 from public.care_team_members where auth_user_id=auth.uid()));
-- Clients cannot forge observations, approval records, alerts or append audit entries directly.
revoke all on public.patients,public.patient_care_team,public.care_team_members,public.messages,public.checkins,public.alerts,public.alert_events,public.protocol_versions from anon,authenticated;
grant select on public.patients,public.patient_care_team,public.care_team_members,public.messages,public.checkins,public.alerts,public.alert_events,public.protocol_versions to authenticated;
grant all on public.patients,public.patient_care_team,public.care_team_members,public.messages,public.checkins,public.alerts,public.alert_events,public.protocol_versions to service_role;

-- Status and audit event commit together. Revision guard prevents lost updates.
create function public.transition_alert(target uuid,action text,expected_revision integer) returns public.alerts
language plpgsql security definer set search_path='' as $$
declare current_alert public.alerts; member uuid;
begin
 select id into member from public.care_team_members where auth_user_id=auth.uid() and role in ('doctor','nurse','coordinator');
 if member is null then raise exception 'Care-team membership required' using errcode='42501';end if;
 select * into current_alert from public.alerts where id=target for update;
 if not found or not public.can_access_patient(current_alert.patient_id) then raise exception 'Report not accessible' using errcode='42501';end if;
 if current_alert.revision<>expected_revision then raise exception 'Revision conflict' using errcode='40001';end if;
 if (action='acknowledge' and current_alert.status='open') then
  update public.alerts set status='acked',acked_by=member,acked_at=now(),revision=revision+1 where id=target returning * into current_alert;
 elsif (action='resolve' and current_alert.status='acked') then
  update public.alerts set status='resolved',revision=revision+1 where id=target returning * into current_alert;
 else raise exception 'Invalid status transition' using errcode='22023';end if;
 insert into public.alert_events(alert_id,event,actor,details_json) values(target,action,member,jsonb_build_object('revision',current_alert.revision));
 return current_alert;
end;
$$;
revoke all on function public.transition_alert(uuid,text,integer) from public;
grant execute on function public.transition_alert(uuid,text,integer) to authenticated;
commit;
