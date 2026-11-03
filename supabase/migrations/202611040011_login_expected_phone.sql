begin;
-- Mobile sign-in now starts from the number the person types: a code only verifies when WhatsApp delivers it from that number.
alter table public.saathi_login_challenges add column if not exists expected_phone text check (expected_phone is null or expected_phone ~ '^[0-9]{8,15}$');
alter table public.saathi_login_challenges add column if not exists mismatch_at timestamptz;
drop function if exists public.saathi_login_challenge(text,integer);
create or replace function public.saathi_login_challenge(p_code text,p_seconds integer,p_phone text) returns uuid language plpgsql set search_path='' as $$
declare v uuid;
begin
 if p_phone is null or p_phone !~ '^[0-9]{8,15}$' then raise exception 'Mobile number required' using errcode='22023';end if;
 delete from public.saathi_login_challenges where expires_at<now()-interval '1 day';
 insert into public.saathi_login_challenges(code,expires_at,expected_phone) values(p_code,now()+make_interval(secs=>least(greatest(p_seconds,60),900)),p_phone) returning id into v;
 return v;
end;$$;
create or replace function public.saathi_login_status(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('verified',verified_phone is not null and consumed_at is null,'expired',expires_at<now(),'mismatch',mismatch_at is not null and verified_phone is null,
  'phone',case when consumed_at is null then verified_phone end)
 from public.saathi_login_challenges where id=p_id;
$$;
create or replace function public.saathi_wa_login(p_messages jsonb) returns integer language plpgsql set search_path='' as $$
declare m jsonb;n integer:=0;c text;
begin
 for m in select * from jsonb_array_elements(coalesce(p_messages,'[]'::jsonb)) loop
  if m->>'kind'='text' and coalesce(m->>'from','') ~ '^[0-9]{8,15}$' then
   c:=substring(m->>'text' from '^\s*[Ll][Oo][Gg][Ii][Nn]\s+([0-9]{6})\s*$');
   if c is not null then
    update public.saathi_login_challenges set verified_phone=m->>'from',verified_at=now()
     where code=c and verified_phone is null and expires_at>now() and (expected_phone is null or expected_phone=m->>'from');
    if found then n:=n+1;
    else update public.saathi_login_challenges set mismatch_at=now() where code=c and verified_phone is null and expires_at>now();end if;
   end if;
  end if;
 end loop;
 return n;
end;$$;
revoke all on function public.saathi_login_challenge(text,integer,text),public.saathi_login_status(uuid),public.saathi_wa_login(jsonb) from public,anon,authenticated;
grant execute on function public.saathi_login_challenge(text,integer,text),public.saathi_login_status(uuid),public.saathi_wa_login(jsonb) to service_role;
commit;
