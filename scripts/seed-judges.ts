import {loadEnvFile} from 'node:process';
import {AccountStore,hashPassword,verifyPassword} from '../apps/web/lib/accounts.ts';
import {JUDGE_EMAIL,JUDGE_PASSWORD,JUDGE_NAME} from '../apps/web/lib/judge-accounts.ts';
// Creates the public judge test login if missing. An existing account is left untouched.
loadEnvFile(new URL('../apps/web/env.local',import.meta.url));
const db=new AccountStore(process.env.NEXT_PUBLIC_SUPABASE_URL??'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');
const existing=await db.find({email:JUDGE_EMAIL});
if(existing)console.log(`${JUDGE_EMAIL}: exists${await verifyPassword(JUDGE_PASSWORD,existing.passwordHash)?'':' (password differs, left unchanged)'}`);
else{await db.create({role:'medical',name:JUDGE_NAME,email:JUDGE_EMAIL,passwordHash:await hashPassword(JUDGE_PASSWORD)});console.log(`${JUDGE_EMAIL}: created`);}
