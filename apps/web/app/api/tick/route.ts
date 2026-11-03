import { z } from 'zod';
import { guard, body, store, json, fail } from '../../../lib/server';
export const runtime='nodejs';
export async function POST(request:Request){try{guard(request,true);z.object({}).strict().parse(await body(request));return json(await store.tick());}catch(e){return fail(e);}}
