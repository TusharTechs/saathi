import {guard,body,json} from '../../../lib/server';
import {pipeline,narrativeFail} from '../../../lib/narrative';
export const runtime='nodejs';
export async function POST(request:Request){try{guard(request,true);return json(await pipeline().text(await body(request)));}catch(e){return narrativeFail(e);}}
