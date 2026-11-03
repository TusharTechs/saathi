import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cloudDocs,cloudKeys} from './cloud.ts';
import {channelNumber} from './worker.ts';
type Env=Record<string,string|undefined>;
// CLI only (kept out of the web bundle): local file reads would make the server bundle trace the whole project.
/** Copies this computer's worker files to Supabase once, so pairings, consent and reminders carry over. */
export async function moveLocalState(env:Env,directory:string){
 const phoneId=env.WA_PHONE_NUMBER_ID??'',docs=cloudDocs(env),k=cloudKeys(phoneId),id=channelNumber(phoneId);
 const files:[string,string][]=[[k.chat,`whatsapp-${id}.json`],[k.oncall,'oncall.json'],[k.reminders,'reminders.json']];
 const result:Record<string,string>={};
 for(const [key,file] of files){let raw:string;try{raw=await readFile(join(directory,file),'utf8');}catch{result[key]='no local file';continue;}result[key]=await docs.seed(key,JSON.parse(raw))?'copied':'cloud copy already exists (kept)';}
 return result;
}
