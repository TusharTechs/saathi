begin;
-- The clinical lead's review form: current answers (autosaved) plus every submission, for Tushar to review.
create table if not exists public.saathi_review(
 reviewer text primary key check (reviewer ~ '^[a-z0-9-]{1,40}$'),
 name text check (name is null or char_length(name)<=80),
 answers jsonb not null default '{}' check (jsonb_typeof(answers)='object'),
 updated_at timestamptz not null default now(),
 submitted_at timestamptz
);
create table if not exists public.saathi_review_submissions(
 id bigint generated always as identity primary key,
 reviewer text not null references public.saathi_review(reviewer) on delete cascade,
 name text,
 answers jsonb not null,
 submitted_at timestamptz not null default now()
);
alter table public.saathi_review enable row level security;
alter table public.saathi_review_submissions enable row level security;
revoke all on public.saathi_review,public.saathi_review_submissions from public,anon,authenticated;
grant all on public.saathi_review,public.saathi_review_submissions to service_role;
revoke all on sequence public.saathi_review_submissions_id_seq from public,anon,authenticated;
grant usage,select on sequence public.saathi_review_submissions_id_seq to service_role;
create or replace function public.saathi_review_get(p_reviewer text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('name',name,'answers',answers,'updatedAt',updated_at,'submittedAt',submitted_at) from public.saathi_review where reviewer=p_reviewer;
$$;
create or replace function public.saathi_review_save(p_reviewer text,p_name text,p_answers jsonb,p_submit boolean) returns jsonb language plpgsql set search_path='' as $$
declare r public.saathi_review;
begin
 insert into public.saathi_review(reviewer,name,answers,updated_at,submitted_at) values(p_reviewer,nullif(btrim(coalesce(p_name,'')),''),p_answers,now(),case when p_submit then now() end)
 on conflict (reviewer) do update set name=excluded.name,answers=excluded.answers,updated_at=now(),submitted_at=case when p_submit then now() else public.saathi_review.submitted_at end
 returning * into r;
 if p_submit then insert into public.saathi_review_submissions(reviewer,name,answers) values(p_reviewer,r.name,p_answers);end if;
 return jsonb_build_object('updatedAt',r.updated_at,'submittedAt',r.submitted_at);
end;$$;
create or replace function public.saathi_review_all() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'current',coalesce((select jsonb_agg(jsonb_build_object('reviewer',reviewer,'name',name,'answers',answers,'updatedAt',updated_at,'submittedAt',submitted_at)) from public.saathi_review),'[]'::jsonb),
  'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'reviewer',reviewer,'name',name,'submittedAt',submitted_at) order by submitted_at desc) from public.saathi_review_submissions),'[]'::jsonb));
$$;
revoke all on function public.saathi_review_get(text),public.saathi_review_save(text,text,jsonb,boolean),public.saathi_review_all() from public,anon,authenticated;
grant execute on function public.saathi_review_get(text),public.saathi_review_save(text,text,jsonb,boolean),public.saathi_review_all() to service_role;
commit;
