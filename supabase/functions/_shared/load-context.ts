import {continuityContext} from './continuity.ts';
export async function loadContext(sb:any,userId:string,conversationId:string|null=null,selectedSituation:string|null=null,selectedGoal:string|null=null) {
 const rows=await Promise.all([
  sb.from('profiles').select('base_profile,assistant_style').eq('user_id',userId).maybeSingle(),
  sb.from('profile_items').select('*').eq('user_id',userId).eq('active',true).limit(80),
  conversationId?sb.from('messages').select('id,conversation_id,role,content,created_at').eq('user_id',userId).eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(24):Promise.resolve({data:[]}),
  sb.from('situations').select('*').eq('user_id',userId).eq('status','open').order('updated_at',{ascending:false}).limit(12),
  sb.from('commitments').select('*').eq('user_id',userId).in('status',['pending','postponed']).order('updated_at',{ascending:false}).limit(10),
  sb.from('hypotheses').select('*').eq('user_id',userId).eq('status','validated').limit(8),
  sb.from('people').select('*').eq('user_id',userId).eq('user_validated',true).limit(12),
  sb.from('agenda_events').select('*').eq('user_id',userId).order('scheduled_start',{ascending:false}).limit(30),
  sb.from('goals').select('*').eq('user_id',userId).eq('status','active').order('updated_at',{ascending:false}).limit(10),
  sb.from('action_reviews').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(30)
 ]);
 if(rows.some(r=>r.error))throw Error('context_unavailable');
 let [profile,profileItems,history,situations,commitments,hypotheses,people,agenda,goals,reviews]=rows.map(r=>r.data);
 // Load all withdrawal records, not merely the latest page of active memories.
 const memories:any[]=[];
 for(let offset=0;offset<10000;offset+=500){
  const r=await sb.from('memories').select('*').eq('user_id',userId).order('id').range(offset,offset+499);
  if(r.error)throw Error('memory_context_unavailable');memories.push(...r.data);
  if(r.data.length<500)break;
  if(offset===9500)throw Error('memory_context_too_large');
 }
 for(const [id,table,collection] of [[selectedSituation,'situations',situations],[selectedGoal,'goals',goals]] as any[]){
  if(id&&!collection.some((x:any)=>x.id===id)){
   const r=await sb.from(table).select('*').eq('user_id',userId).eq('id',id).maybeSingle();
   if(r.error||!r.data)throw Error('selected_context_not_found');collection.push(r.data);
  }
 }
 const ids=[...new Set([...memories,...situations,...commitments,...agenda].map(x=>x.source_message_id).filter(Boolean))];
 const sources:any[]=[];
 for(let i=0;i<ids.length;i+=100){
  const r=await sb.from('messages').select('id,conversation_id').eq('user_id',userId).in('id',ids.slice(i,i+100));
  if(r.error)throw Error('source_context_unavailable');sources.push(...r.data);
 }
 const withdrawn=memories.filter(m=>['obsolete','do_not_store'].includes(m.status)||['rejected','corrected'].includes(m.user_validation)).map(m=>m.id);
 const memoryUses:any[]=[];
 for(let i=0;i<withdrawn.length;i+=100){
  const r=await sb.from('turn_receipts').select('conversation_id,memory_ids').eq('user_id',userId).overlaps('memory_ids',withdrawn.slice(i,i+100));
  if(r.error)throw Error('memory_usage_unavailable');memoryUses.push(...r.data);
 }
 const context=continuityContext({memories,sources,history,situations,commitments,agenda,goals,reviews,memoryUses});
 return {...context,profile:context.allowLegacy?profile:null,profileItems:context.allowLegacy?profileItems:[],
  hypotheses:context.allowLegacy?hypotheses:[],people:context.allowLegacy?people:[]};
}

