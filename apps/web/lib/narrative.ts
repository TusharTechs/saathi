import {SupabaseStore,WorkflowError,closedMessage} from '../../../packages/workflow/src/index';
import {NarrativePipeline} from '../../../packages/extraction/src/pipeline';
import {ProviderError} from '../../../packages/extraction/src/index';
import {store,fail} from './server';
export function pipeline(){
 if(!(store instanceof SupabaseStore))throw new WorkflowError(503,'Voice and text extraction require Supabase storage. Button intake remains available in local mode.');
 return new NarrativePipeline(store,{sarvam:process.env.SARVAM_API_KEY??'',groq:process.env.GROQ_API_KEY??''});
}
export function narrativeFail(error:unknown){
 if(error instanceof ProviderError)return fail(new WorkflowError(error.kind==='invalid_response'?422:503,error.message));
 return fail(error);
}
/** Families of a patient whose Saathi follow-up is closed cannot file new requests; they are pointed to the OPD. */
export async function assertActive(patientId:string){
 const plans:Record<string,{plan:{closure?:unknown;demographics:{name:string}}}>=await store.carePlans();const plan=plans[patientId]?.plan;
 if(plan?.closure)throw new WorkflowError(403,closedMessage(plan.demographics.name));
}
