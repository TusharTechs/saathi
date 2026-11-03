import {loadEnvFile} from 'node:process';
import {readFile} from 'node:fs/promises';
import {savedSchema,SupabaseStore,type Snapshot} from '../packages/workflow/src/index.ts';
import {inputSchema} from '../packages/shared/src/index.ts';
const root=new URL('../',import.meta.url);
try{
 loadEnvFile(new URL('apps/web/.env.local',root));
 let text:string;
 try{text=await readFile(new URL('apps/web/.saathi-demo/queue.json',root),'utf8');}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT'){console.log('No local queue exists. Nothing to import.');process.exit(0);}throw e;}
 const snapshot=savedSchema.parse(JSON.parse(text)) as unknown as Snapshot;
 // Validate every record before the first external write.
 for(const record of snapshot.records)inputSchema.parse(record.report.input);
 const store=new SupabaseStore(process.env.NEXT_PUBLIC_SUPABASE_URL??'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');
 let added=0,existing=0;
 for(const record of snapshot.records){const r=await store.importLocal(record);r.duplicate?existing++:added++;}
 console.log(`Synthetic local history copied to Supabase: ${added} added, ${existing} already present. Source file unchanged.`);
}catch{console.error('Import failed. No credentials or report contents were printed. Prior successful imports remain; retrying the same source is safe.');process.exitCode=1;}
