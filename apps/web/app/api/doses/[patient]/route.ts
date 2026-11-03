import { guard, store, json, fail } from '../../../../lib/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{patient:string}>}){try{guard(request);const {patient}=await context.params;return json(await store.doseLogs(patient));}catch(e){return fail(e);}}
