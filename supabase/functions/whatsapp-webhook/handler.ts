/** Dependency-free handler shared by Edge runtime and Node integration tests. */
export type Inbound={id:string;from:string;timestamp:number;kind:'text'|'voice'|'button';text?:string;mediaId?:string;buttonId?:string};
export type WebhookConfig={appSecret:string;verifyToken:string;phoneId:string};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const text=(v:unknown)=>typeof v==='string'?v:'';
export function normalize(payload:unknown,phoneId:string):Inbound[]{
 const root=object(payload);if(root.object!=='whatsapp_business_account')throw Error('Invalid webhook object');const result:Inbound[]=[];
 for(const entry of list(root.entry))for(const change of list(object(entry).changes)){
  const c=object(change),value=object(c.value);if(c.field!=='messages'||text(object(value.metadata).phone_number_id)!==phoneId||value.messaging_product!=='whatsapp')continue;
  for(const item of list(value.messages)){
   const m=object(item),id=text(m.id),from=text(m.from),timestamp=Number(m.timestamp);
   if(!/^wamid\.[A-Za-z0-9+/=_-]{1,500}$/.test(id)||!/^\d{8,15}$/.test(from)||!Number.isSafeInteger(timestamp)||timestamp<=0)continue;
   const base={id,from,timestamp};
   if(m.type==='text'){const body=text(object(m.text).body);if(body.trim()&&body.length<=4000)result.push({...base,kind:'text',text:body});}
   if(m.type==='audio'){const mediaId=text(object(m.audio).id);if(/^\d{1,40}$/.test(mediaId))result.push({...base,kind:'voice',mediaId});}
   if(m.type==='interactive'){const i=object(m.interactive);const buttonId=text(object(i.type==='button_reply'?i.button_reply:i.type==='list_reply'?i.list_reply:undefined).id);if(buttonId&&buttonId.length<=64)result.push({...base,kind:'button',buttonId});}
  }
 }
 return result;
}
async function bounded(request:Request){
 const reader=request.body?.getReader();if(!reader)throw Error('body');let total=0;const chunks:Uint8Array[]=[];
 while(true){const next=await reader.read();if(next.done)break;total+=next.value.length;if(total>262144){await reader.cancel();throw Error('size');}chunks.push(next.value);}
 const bytes=new Uint8Array(total);let position=0;for(const c of chunks){bytes.set(c,position);position+=c.length;}return bytes;
}
const plain=(body:string,status:number)=>new Response(body,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
function equal(a:string,b:string){const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]??0)^(y[i]??0);return diff===0;}
export function webhook(config:WebhookConfig,enqueue:(messages:Inbound[])=>Promise<unknown>){
 return async(request:Request):Promise<Response>=>{
  if(config.appSecret.length<32||config.verifyToken.length<32||!/^\d{1,40}$/.test(config.phoneId))return plain('Not configured',503);
  if(request.method==='GET'){
   const q=new URL(request.url).searchParams,challenge=q.get('hub.challenge');
   return q.get('hub.mode')==='subscribe'&&equal(q.get('hub.verify_token')??'',config.verifyToken)&&challenge&&/^\d{1,200}$/.test(challenge)?plain(challenge,200):plain('Forbidden',403);
  }
  if(request.method!=='POST')return plain('Method not allowed',405);
  let bytes:Uint8Array;try{bytes=await bounded(request);}catch{return plain('Invalid or oversized body',413);}
  const signature=request.headers.get('x-hub-signature-256')??'';
  if(!/^sha256=[a-fA-F0-9]{64}$/.test(signature))return plain('Forbidden',403);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.appSecret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const hash=Uint8Array.from(signature.slice(7).match(/../g)!,v=>parseInt(v,16));
  if(!await crypto.subtle.verify('HMAC',key,hash,new Uint8Array(bytes)))return plain('Forbidden',403);
  let messages:Inbound[];try{messages=normalize(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),config.phoneId);}catch{return plain('Invalid payload',400);}
  try{if(messages.length)await enqueue(messages);}catch{return plain('Storage unavailable',503);}
  // Acknowledge after durable storage, before any speech/model/outbound work.
  return plain('EVENT_RECEIVED',200);
 };
}
