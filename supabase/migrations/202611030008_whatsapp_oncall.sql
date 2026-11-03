-- Lets an unpaired care-team phone send /oncall <code>, /oncall, /offcall and Acknowledge taps for alerts.
-- Family reports from unpaired senders are still discarded without storing their content.
begin;
create or replace function public.saathi_wa_enqueue(p_phone text,p_messages jsonb) returns jsonb language plpgsql set search_path='' as $$
declare item jsonb;b public.wa_demo_bindings;n integer:=0;t numeric;allowed boolean;
begin
 if p_phone !~ '^[0-9]{1,40}$' or jsonb_typeof(p_messages) is distinct from 'array' or jsonb_array_length(p_messages)>100 then raise exception 'Invalid inbox batch' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(p_messages) loop
  if coalesce(item->>'id','') !~ '^wamid\.[A-Za-z0-9+/=_-]+$' or length(item->>'id')>506 or coalesce(item->>'from','') !~ '^[0-9]{8,15}$' or coalesce(item->>'timestamp','') !~ '^[0-9]{1,15}$' then continue;end if;
  t:=(item->>'timestamp')::numeric;if t<extract(epoch from now()-interval '24 hours') or t>extract(epoch from now()+interval '5 minutes') then continue;end if;
  select * into b from public.wa_demo_bindings where phone_id=p_phone and sender_id=item->>'from' and expires_at>now();
  allowed:=case when item->>'kind'='text' then coalesce(item->>'text','') ~ '^/(start|oncall)( [A-Za-z0-9_-]{32})?$' or item->>'text'='/offcall'
   when item->>'kind'='button' then coalesce(item->>'buttonId','') ~ '^ack:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' else false end;
  if b.sender_id is not null then allowed:=allowed or b.consented or item->>'kind'='button' or item->>'text'='/stop';end if;
  if not coalesce(allowed,false) or coalesce(item->>'kind','') not in ('text','voice','button') then continue;end if;
  insert into public.wa_demo_inbox(phone_id,message_id,payload) values(p_phone,item->>'id',item) on conflict(phone_id,message_id) do nothing;
  if found then n:=n+1;end if;
 end loop;
 return jsonb_build_object('accepted',n);
end;
$$;
revoke all on function public.saathi_wa_enqueue(text,jsonb) from public,anon,authenticated;
grant execute on function public.saathi_wa_enqueue(text,jsonb) to service_role;
commit;
