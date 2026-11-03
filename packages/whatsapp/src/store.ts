import {z} from 'zod';
import {SupabaseStore} from '../../workflow/src/supabase-store.ts';
import type {State} from '../../telegram/src/state.ts';
export const inboundSchema=z.object({id:z.string().regex(/^wamid\.[A-Za-z0-9+/=_-]{1,500}$/),from:z.string().regex(/^\d{8,15}$/),timestamp:z.number().int().positive(),kind:z.enum(['text','voice','button']),text:z.string().max(4000).optional(),mediaId:z.string().optional(),buttonId:z.string().max(64).optional()});
export type Inbound=z.infer<typeof inboundSchema>;
export class WhatsAppStore extends SupabaseStore {
 async next(phone:string,offset:number){return z.object({id:z.number().int().nonnegative(),message:inboundSchema}).nullable().parse(await this.rpc('saathi_wa_next',{p_phone:phone,p_offset:offset}));}
 async complete(phone:string,offset:number){await this.rpc('saathi_wa_complete',{p_phone:phone,p_offset:offset});}
 async binding(phone:string,sender:number,session:State['chats'][string]|undefined){
  const consented=Boolean(session?.consentAt&&Date.now()-session.consentAt<86400000);
  const expires=consented?session!.consentAt!+86400000:session?.pendingUntil;
  await this.rpc('saathi_wa_binding',{p_phone:phone,p_sender:String(sender),p_consented:consented,p_expires:expires?new Date(expires).toISOString():null});
 }
}
