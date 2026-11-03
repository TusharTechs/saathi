import { guard, store, json, fail } from '../../../lib/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{guard(request);return json(await store.queue());}catch(e){return fail(e);}}
