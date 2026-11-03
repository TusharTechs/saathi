import {loadEnvFile} from 'node:process';
import {mkdir,writeFile} from 'node:fs/promises';
import {SupabaseStore} from '../packages/workflow/src/supabase-store.ts';
import {SECTIONS} from '../apps/web/lib/review-questions.ts';
// Writes the clinical lead's current answers to output/review/ as Markdown, for the project docs.
loadEnvFile(new URL('../apps/web/env.local',import.meta.url));
const db=new SupabaseStore(process.env.NEXT_PUBLIC_SUPABASE_URL??'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');
const all=await db.reviewAll(),r=all.current[0];
if(!r){console.log('No answers saved yet.');process.exit(0);}
type A={choice?:string|string[];details?:string};
const text=(a?:A)=>!a?'':Array.isArray(a.choice)?a.choice.join('; '):a.choice??'';
const answers=r.answers as Record<string,A>;
const md=[`# Clinical review answers · ${r.name??'Clinical lead'}`,`Last saved ${r.updatedAt}${r.submittedAt?` · submitted ${r.submittedAt}`:' · NOT SUBMITTED (autosaved draft)'}`,'',
 ...SECTIONS.flatMap(s=>[`## ${s.id}. ${s.title}`,...s.questions.map(q=>`- **${q.id} · ${q.title}:** ${text(answers[q.id])||'_not answered_'}${answers[q.id]?.details?`\n  - Note: ${answers[q.id]!.details!.replace(/\n/g,'\n    ')}`:''}`),''])].join('\n');
await mkdir(new URL('../output/review/',import.meta.url),{recursive:true});
const file=new URL(`../output/review/clinical-review-answers-${new Date().toISOString().slice(0,10)}.md`,import.meta.url);
await writeFile(file,md);console.log(`Wrote ${file.pathname} (${all.submissions.length} submission(s)).`);
