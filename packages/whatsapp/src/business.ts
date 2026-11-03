import {z} from 'zod';
import {WhatsAppError} from './api.ts';
/** Read-only readiness inspection for a real (possibly shared) WhatsApp Business Account. Never returns tokens, secrets or other senders. */
export type BusinessConfig={appId:string;appSecret:string;wabaId:string;phoneId:string};
export const tokenSchema=z.object({data:z.object({app_id:z.string().optional(),is_valid:z.boolean(),expires_at:z.number().optional(),data_access_expires_at:z.number().optional(),scopes:z.array(z.string()).default([]),granular_scopes:z.array(z.object({scope:z.string(),target_ids:z.array(z.string()).optional()})).default([])})});
export const phoneSchema=z.object({id:z.string(),display_phone_number:z.string().optional(),verified_name:z.string().optional(),platform_type:z.string().optional(),status:z.string().optional(),name_status:z.string().optional(),quality_rating:z.string().optional(),code_verification_status:z.string().optional(),messaging_limit_tier:z.string().optional()});
export const accountSchema=z.object({id:z.string(),name:z.string().optional()});
export const subscriptionsSchema=z.object({data:z.array(z.object({whatsapp_business_api_data:z.object({id:z.string()}).partial().optional()})).default([])});
export type Inspection={token:z.infer<typeof tokenSchema>['data'];assignedWabaIds:string[];account:z.infer<typeof accountSchema>|null;phones:z.infer<typeof phoneSchema>[];subscribedApps:string[]};
const assignedSchema=z.object({data:z.array(z.object({id:z.string()})).default([])});
export type Check={id:string;level:'ok'|'warn'|'block';detail:string};
const SCOPES=['whatsapp_business_messaging','whatsapp_business_management'];
export function readiness(config:BusinessConfig,inspection:Inspection,now=Date.now()):{ready:boolean;checks:Check[]}{
 const {token,assignedWabaIds,account,phones,subscribedApps}=inspection,checks:Check[]=[];
 const add=(id:string,pass:boolean,detail:string,fail:'warn'|'block'='block')=>checks.push({id,level:pass?'ok':fail,detail});
 add('token.valid',token.is_valid,token.is_valid?'Access token accepted by Meta.':'Access token is invalid or revoked.');
 add('token.app',token.app_id===config.appId,token.app_id===config.appId?'Token belongs to WA_APP_ID.':'Token was issued for a different Meta app than WA_APP_ID; webhook signatures would not match.');
 const expiry=token.expires_at??0;
 add('token.permanent',expiry===0,expiry===0?'Token does not expire (system-user token).':`Token expires ${new Date(expiry*1000).toISOString()}; generate a non-expiring system-user token for the WABA.`,expiry*1000>now?'warn':'block');
 const missing=SCOPES.filter(s=>!token.scopes.includes(s));
 add('token.scopes',!missing.length,missing.length?`Token lacks ${missing.join(', ')}.`:'Token has messaging and management permissions.');
 const targets=token.granular_scopes.filter(g=>SCOPES.includes(g.scope)).map(g=>g.target_ids);
 const covered=assignedWabaIds.includes(config.wabaId)||(targets.length>0&&targets.every(ids=>ids?.includes(config.wabaId)));
 const assigned=assignedWabaIds.length?`assigned WhatsApp account IDs: ${assignedWabaIds.join(', ')}`:'no WhatsApp account is assigned to the system user';
 add('token.waba',covered,covered?'Token is granted on WA_BUSINESS_ACCOUNT_ID.':`Token is not granted on WA_BUSINESS_ACCOUNT_ID (${assigned}). In Business settings > System users > Assign assets, give the system user full control of the WhatsApp account, or correct the ID.`);
 if(!account){add('waba.access',false,'Meta cannot load WA_BUSINESS_ACCOUNT_ID with this token, so number and webhook checks were skipped.');return {ready:false,checks};}
 add('waba.id',account.id===config.wabaId,account.id===config.wabaId?`WABA reachable${account.name?` (${account.name})`:''}.`:'Meta returned a different WABA.');
 const phone=phones.find(p=>p.id===config.phoneId);
 add('phone.in_waba',Boolean(phone),phone?'WA_PHONE_NUMBER_ID belongs to this WABA.':'WA_PHONE_NUMBER_ID is not a number in this WABA.');
 add('phone.dedicated',phones.length<=1,phones.length<=1?'Saathi number is the only number in this WABA.':`This WABA has ${phones.length} numbers. Webhooks for every number reach the receiver before the phone filter discards them; use a WABA dedicated to the synthetic demo.`,'warn');
 if(phone){
  add('phone.cloud_api',phone.platform_type==='CLOUD_API',phone.platform_type==='CLOUD_API'?'Number is registered for Cloud API.':`Number platform is ${phone.platform_type??'unknown'}; it must be registered for Cloud API (whatsapp:register).`);
  add('phone.connected',!phone.status||phone.status==='CONNECTED',`Number status: ${phone.status??'not reported'}.`,'warn');
  add('phone.display_name',!phone.name_status||['APPROVED','AVAILABLE_WITHOUT_REVIEW'].includes(phone.name_status),`Display name status: ${phone.name_status??'not reported'}.`,'warn');
  add('phone.quality',phone.quality_rating!=='RED',`Quality rating: ${phone.quality_rating??'not reported'}.`,'warn');
 }
 const subscribed=subscribedApps.includes(config.appId);
 add('webhook.subscribed',subscribed,subscribed?'App is subscribed to this WABA\'s webhooks.':'App is not subscribed to this WABA; incoming messages will not be delivered (whatsapp:subscribe).');
 return {ready:!checks.some(c=>c.level==='block'),checks};
}
/** Finds the app and WABA IDs a token was issued for, using only that token (read-only). */
export async function discover(token:string,version='v26.0',transport:typeof fetch=fetch){
 let r:Response;try{r=await transport(`https://graph.facebook.com/${version}/debug_token?input_token=${encodeURIComponent(token)}`,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new WhatsAppError('unknown','Meta did not confirm the token lookup.');}
 if(!r.ok)throw new WhatsAppError('configuration',`Meta could not inspect WA_ACCESS_TOKEN (HTTP ${r.status}). Response details were withheld.`);
 const data=tokenSchema.parse(await r.json()).data;
 let assigned:string[]=[];
 try{const a=await transport(`https://graph.facebook.com/${version}/me/assigned_whatsapp_business_accounts?fields=id`,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(20000)});if(a.ok)assigned=assignedSchema.parse(await a.json()).data.map(w=>w.id);}catch{/* Granular scopes remain the fallback. */}
 const wabaIds=[...new Set([...assigned,...data.granular_scopes.filter(g=>SCOPES.includes(g.scope)).flatMap(g=>g.target_ids??[])])];
 return {appId:data.app_id,wabaIds,isValid:data.is_valid};
}
export class WhatsAppBusiness {
 constructor(private config:BusinessConfig,private token:string,private version='v26.0',private transport:typeof fetch=fetch){
  if(!/^\d{1,40}$/.test(config.appId)||!/^\d{1,40}$/.test(config.wabaId)||!/^\d{1,40}$/.test(config.phoneId)||config.appSecret.length<32||!token||!/^v\d{2}\.0$/.test(version))throw new WhatsAppError('configuration','Configure WA_APP_ID, WA_APP_SECRET, WA_BUSINESS_ACCOUNT_ID, WA_PHONE_NUMBER_ID and WA_ACCESS_TOKEN.');
 }
 private async graph(path:string,options:{method?:'GET'|'POST';payload?:object;bearer?:string}={}){
  const method=options.method??'GET';let r:Response;
  try{r=await this.transport(`https://graph.facebook.com/${this.version}/${path}`,{method,headers:{Authorization:`Bearer ${options.bearer??this.token}`,...(options.payload?{'Content-Type':'application/json'}:{})},body:options.payload?JSON.stringify(options.payload):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new WhatsAppError('unknown','Meta did not confirm the request. No automatic retry was made.');}
  if(!r.ok){
   // Meta's numeric error code is safe to show; its message text is withheld.
   const code=z.object({error:z.object({code:z.number().optional(),error_subcode:z.number().optional()})}).safeParse(await r.json().catch(()=>null)),e=code.success?code.data.error:{};
   throw new WhatsAppError(r.status>=500?'unknown':r.status===401||r.status===403?'configuration':'rejected',`Meta rejected ${method} ${path.split('?')[0]!.replace(/\d{5,}/g,'<id>')} (HTTP ${r.status}${e.code?`, code ${e.code}${e.error_subcode?'/'+e.error_subcode:''}`:''}). Response details were withheld.`);
  }
  try{return await r.json() as unknown;}catch{throw new WhatsAppError('unknown','Meta returned an unreadable response.');}
 }
 async inspect():Promise<Inspection>{
  const {appId,appSecret,wabaId}=this.config;
  // App access token travels only in the Authorization header, never in a URL.
  const token=tokenSchema.parse(await this.graph(`debug_token?input_token=${encodeURIComponent(this.token)}`,{bearer:`${appId}|${appSecret}`})).data;
  const assignedWabaIds=await this.graph('me/assigned_whatsapp_business_accounts?fields=id').then(r=>assignedSchema.parse(r).data.map(w=>w.id),()=>[]);
  let account:Inspection['account'];
  try{account=accountSchema.parse(await this.graph(`${wabaId}?fields=id,name`));}catch(e){if(e instanceof WhatsAppError&&e.kind==='rejected')return {token,assignedWabaIds,account:null,phones:[],subscribedApps:[]};throw e;}
  const phones=z.object({data:z.array(phoneSchema)}).parse(await this.graph(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,platform_type,status,name_status,quality_rating,code_verification_status,messaging_limit_tier`)).data;
  const subscribedApps=subscriptionsSchema.parse(await this.graph(`${wabaId}/subscribed_apps`)).data.map(a=>a.whatsapp_business_api_data?.id).filter((id):id is string=>Boolean(id));
  return {token,assignedWabaIds,account,phones,subscribedApps};
 }
 /** Subscribes this app to the WABA's webhooks. Leaves other subscribed apps and any callback overrides untouched. */
 async subscribe(){
  const current=await this.inspect();
  if(!current.account)throw new WhatsAppError('configuration','This token cannot load WA_BUSINESS_ACCOUNT_ID. Nothing was subscribed.');
  if(current.subscribedApps.includes(this.config.appId))return {changed:false};
  z.object({success:z.literal(true)}).parse(await this.graph(`${this.config.wabaId}/subscribed_apps`,{method:'POST'}));return {changed:true};
 }
 /** Registers the number for Cloud API. Meta allows 10 attempts per 72 hours; refuses numbers that are already registered. */
 async register(pin:string){
  if(!/^\d{6}$/.test(pin))throw new WhatsAppError('configuration','WA_TWO_STEP_PIN must be the 6-digit two-step verification PIN.');
  const phone=(await this.inspect()).phones.find(p=>p.id===this.config.phoneId);
  if(!phone)throw new WhatsAppError('configuration','WA_PHONE_NUMBER_ID is not a number in this WABA. Nothing was registered.');
  if(phone.platform_type==='CLOUD_API')return {changed:false};
  z.object({success:z.literal(true)}).parse(await this.graph(`${this.config.phoneId}/register`,{method:'POST',payload:{messaging_product:'whatsapp',pin}}));return {changed:true};
 }
}
