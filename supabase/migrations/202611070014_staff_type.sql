-- Nurses and psychologists sign in as medical staff but cannot change prescriptions (Dr. Rao, 7 Nov).
begin;
alter table public.saathi_accounts add column if not exists staff_type text check (staff_type is null or staff_type in ('doctor','nurse','psychologist'));
create or replace function public.saathi_account_find(p_email text,p_phone text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',id,'role',role,'name',name,'email',email,'phone',phone,'patientKey',patient_key,'passwordHash',password_hash,'staffType',staff_type)
 from public.saathi_accounts where (p_email is not null and email=lower(btrim(p_email))) or (p_phone is not null and phone=p_phone) limit 1;
$$;
create or replace function public.saathi_account_set_staff(p_id uuid,p_staff text) returns void language plpgsql set search_path='' as $$
begin
 if p_staff not in ('doctor','nurse','psychologist') then raise exception 'Invalid staff type' using errcode='22023';end if;
 update public.saathi_accounts set staff_type=p_staff where id=p_id and role='medical';
end;$$;
revoke all on function public.saathi_account_find(text,text),public.saathi_account_set_staff(uuid,text) from public,anon,authenticated;
grant execute on function public.saathi_account_find(text,text),public.saathi_account_set_staff(uuid,text) to service_role;
commit;
