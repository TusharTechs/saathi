-- Synthetic patients and unlinked demo team. No invented auth.users or clinical approvals.
-- Supply real auth-user links and assignments through a trusted administrator later.
insert into public.care_team_members(id,name,role,on_call_order) values
 ('20000000-0000-4000-8000-000000000001','Demo doctor 1','doctor',1),
 ('20000000-0000-4000-8000-000000000002','Demo doctor 2','doctor',2),
 ('20000000-0000-4000-8000-000000000003','Demo coordinator','coordinator',3)
on conflict(id) do nothing;
insert into public.patients(id,display_name,age,pack,language) values
 ('10000000-0000-4000-8000-000000000001','Synthetic Arjun Mehta',45,'adult','en'),
 ('10000000-0000-4000-8000-000000000002','Synthetic Lakshmi S.',58,'adult','kn'),
 ('10000000-0000-4000-8000-000000000003','Synthetic Fatima A.',47,'adult','hi'),
 ('10000000-0000-4000-8000-000000000004','Synthetic Suresh P.',71,'adult','en'),
 ('10000000-0000-4000-8000-000000000005','Synthetic Meena R.',56,'adult','kn')
on conflict(id) do nothing;
