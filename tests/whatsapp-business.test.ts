import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WhatsAppBusiness,WhatsAppError,discover,readiness,type Inspection} from '../packages/whatsapp/src/index.ts';
const config={appId:'111',appSecret:'a'.repeat(32),wabaId:'222',phoneId:'333'},token='private-system-user-token';
const healthy=():Inspection=>({token:{app_id:'111',is_valid:true,expires_at:0,scopes:['whatsapp_business_messaging','whatsapp_business_management'],granular_scopes:[{scope:'whatsapp_business_messaging',target_ids:['222']},{scope:'whatsapp_business_management',target_ids:['222']}]},account:{id:'222',name:'Synthetic demo WABA'},phones:[{id:'333',platform_type:'CLOUD_API',status:'CONNECTED',name_status:'APPROVED',quality_rating:'GREEN'}],subscribedApps:['111']});
const level=(r:ReturnType<typeof readiness>,id:string)=>r.checks.find(c=>c.id===id)?.level;
test('a dedicated, subscribed Cloud API number with a permanent scoped token is ready',()=>{
 const r=readiness(config,healthy());assert.equal(r.ready,true);assert.ok(r.checks.every(c=>c.level==='ok'));
});
test('missing webhook subscription, foreign token app, wrong WABA grant or unregistered number block readiness',()=>{
 for(const [id,change] of [
  ['webhook.subscribed',(i:Inspection)=>{i.subscribedApps=['999'];}],
  ['token.app',(i:Inspection)=>{i.token.app_id='999';}],
  ['token.waba',(i:Inspection)=>{i.token.granular_scopes[0]!.target_ids=['999'];}],
  ['token.scopes',(i:Inspection)=>{i.token.scopes=['whatsapp_business_messaging'];}],
  ['phone.in_waba',(i:Inspection)=>{i.phones=[{id:'444',platform_type:'CLOUD_API'}];}],
  ['phone.cloud_api',(i:Inspection)=>{i.phones[0]!.platform_type='NOT_APPLICABLE';}],
 ] as const){const i=healthy();change(i);const r=readiness(config,i);assert.equal(r.ready,false,id);assert.equal(level(r,id),'block',id);}
});
test('expiring tokens, shared WABAs and pending display names warn without blocking',()=>{
 const i=healthy();i.token.expires_at=Math.floor(Date.now()/1000)+3600;i.phones.push({id:'555'});i.phones[0]!.name_status='PENDING_REVIEW';
 const r=readiness(config,i);assert.equal(r.ready,true);for(const id of ['token.permanent','phone.dedicated','phone.display_name'])assert.equal(level(r,id),'warn',id);
 i.token.expires_at=1;assert.equal(level(readiness(config,i),'token.permanent'),'block');
});
test('inspection keeps the app secret out of URLs and withholds Meta error bodies',async()=>{
 const urls:string[]=[];const auth:string[]=[];
 const business=new WhatsAppBusiness(config,token,'v26.0',async(url,options)=>{const u=String(url);urls.push(u);auth.push(String((options?.headers as Record<string,string>).Authorization));
  if(u.includes('debug_token'))return Response.json({data:healthy().token});if(u.includes('/phone_numbers'))return Response.json({data:healthy().phones});
  if(u.includes('/subscribed_apps'))return Response.json({data:[{whatsapp_business_api_data:{id:'111',name:'Saathi'}}]});return Response.json({id:'222'});});
 const inspection=await business.inspect();assert.equal(readiness(config,inspection).ready,true);
 assert.ok(urls.every(u=>u.startsWith('https://graph.facebook.com/v26.0/')&&!u.includes(config.appSecret)));assert.equal(auth[0],`Bearer 111|${config.appSecret}`);assert.ok(auth.slice(1).every(a=>a===`Bearer ${token}`));
 const failing=new WhatsAppBusiness(config,token,'v26.0',async()=>Response.json({error:{message:'secret detail '+token}},{status:400}));
 await assert.rejects(failing.inspect(),e=>e instanceof WhatsAppError&&!e.message.includes(token)&&!e.message.includes('secret detail'));
});
test('subscribe and register are idempotent and refuse unsafe registration',async()=>{
 const posts:string[]=[];let state=healthy();
 const transport:typeof fetch=async(url,options)=>{const u=String(url);if(options?.method==='POST'){posts.push(u.replace('https://graph.facebook.com/v26.0/',''));return Response.json({success:true});}
  if(u.includes('debug_token'))return Response.json({data:state.token});if(u.includes('/phone_numbers'))return Response.json({data:state.phones});if(u.includes('/subscribed_apps'))return Response.json({data:state.subscribedApps.map(id=>({whatsapp_business_api_data:{id}}))});return Response.json({id:'222'});};
 const business=new WhatsAppBusiness(config,token,'v26.0',transport);
 assert.deepEqual(await business.subscribe(),{changed:false});assert.deepEqual(await business.register('123456'),{changed:false});assert.deepEqual(posts,[]);
 state.subscribedApps=[];state.phones[0]!.platform_type='NOT_APPLICABLE';
 assert.deepEqual(await business.subscribe(),{changed:true});assert.deepEqual(await business.register('123456'),{changed:true});assert.deepEqual(posts,['222/subscribed_apps','333/register']);
 await assert.rejects(business.register('12345'),WhatsAppError);state.phones=[{id:'444'}];await assert.rejects(business.register('123456'),WhatsAppError);assert.equal(posts.length,2);
 assert.throws(()=>new WhatsAppBusiness({...config,appSecret:'short'},token),WhatsAppError);
});
test('discovery reports the app and WABA IDs a token is granted on, without secrets',async()=>{
 const found=await discover(token,'v26.0',async(url,options)=>{assert.ok(String(url).includes('debug_token'));assert.equal((options?.headers as Record<string,string>).Authorization,`Bearer ${token}`);return Response.json({data:healthy().token});});
 assert.deepEqual(found,{appId:'111',wabaIds:['222'],isValid:true});
});
