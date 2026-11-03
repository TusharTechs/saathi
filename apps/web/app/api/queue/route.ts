import { guard, json, fail } from '../../../lib/server';
import { workspace } from '../../../lib/workspace';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{guard(request);return json(await workspace());}catch(e){return fail(e);}}
