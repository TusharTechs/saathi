-- Supabase default privileges may grant EXECUTE directly to anon/authenticated.
-- Revoking PUBLIC alone does not remove those explicit grants.
begin;
revoke all on function public.can_access_patient(uuid) from public,anon,authenticated;
grant execute on function public.can_access_patient(uuid) to authenticated;
revoke all on function public.transition_alert(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.transition_alert(uuid,text,integer) to authenticated;
commit;
