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
 if(!selectedSituation&&selectedGoal){
  selectedSituation=goals.find((g:any)=>g.id===selectedGoal)?.situation_id||null;
  if(!selectedSituation){
   const links=await Promise.all(['commitments','agenda_events'].map(table=>sb.from(table).select('situation_id').eq('user_id',userId).eq('goal_id',selectedGoal)));
   if(links.some(r=>r.error))throw Error('goal_links_unavailable');
   const ids=[...new Set(links.flatMap(r=>r.data.map((x:any)=>x.situation_id)).filter(Boolean))];
   if(ids.length===1)selectedSituation=ids[0] as string;
  }
  if(selectedSituation&&!situations.some((s:any)=>s.id===selectedSituation)){
   const r=await sb.from('situations').select('*').eq('user_id',userId).eq('id',selectedSituation).maybeSingle();
   if(r.error||!r.data)throw Error('selected_context_not_found');situations.push(r.data);
  }
 }
 // Explicitly selected work is loaded independently of the general recent page.
 const allSelected=async(query:any)=>{
  const result:any[]=[];
  for(let offset=0;offset<10000;offset+=500){
   const r=await query.range(offset,offset+499);
   if(r.error)throw Error('selected_context_unavailable');result.push(...r.data);
   if(r.data.length<500)return result;
  }
  throw Error('selected_context_too_large');
 };
 const merge=(target:any[],extra:any[])=>{for(const x of extra)if(!target.some(y=>y.id===x.id))target.push(x)};
 for(const [column,id] of [['situation_id',selectedSituation],['goal_id',selectedGoal]])if(id){
  for(const [table,target] of [['agenda_events',agenda],['commitments',commitments]] as any[]){
   merge(target,await allSelected(sb.from(table).select('*').eq('user_id',userId).eq(column,id).order('id')));
  }
 }
 const selectedEvents=agenda.filter((a:any)=>selectedSituation&&a.situation_id===selectedSituation||selectedGoal&&a.goal_id===selectedGoal).map((a:any)=>a.id);
 for(let i=0;i<selectedEvents.length;i+=100){
  merge(reviews,await allSelected(sb.from('action_reviews').select('*').eq('user_id',userId).in('event_id',selectedEvents.slice(i,i+100)).order('id')));
 }
 // Corrections can inherit a step from a withdrawn declaration outside the
 // recent page. Load their ancestry before deciding whether a step is current.
 const checkedParents=new Set();
 for(let depth=0;depth<100;depth++){
  const parents=[...new Set(reviews.map((r:any)=>r.supersedes_id).filter((id:any)=>id&&!checkedParents.has(id)&&!reviews.some((r:any)=>r.id===id)))];
  if(!parents.length)break;
  for(let i=0;i<parents.length;i+=100){
   const batch=parents.slice(i,i+100);
   const r=await sb.from('action_reviews').select('*').eq('user_id',userId).in('id',batch);
   if(r.error)throw Error('review_ancestry_unavailable');batch.forEach(id=>checkedParents.add(id));merge(reviews,r.data);
  }
  if(depth===99)throw Error('review_ancestry_too_deep');
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
 const revisions:any[]=[];
 for(let i=0;i<withdrawn.length;i+=100){
  const r=await sb.from('memory_revisions').select('memory_id,before_data').eq('user_id',userId).in('memory_id',withdrawn.slice(i,i+100));
  if(r.error)throw Error('memory_revisions_unavailable');revisions.push(...r.data);
 }
 const prioritize=(rows:any[])=>rows.sort((a:any,b:any)=>Number(Boolean(b.id===selectedSituation||b.id===selectedGoal||b.situation_id===selectedSituation&&selectedSituation||b.goal_id===selectedGoal&&selectedGoal||selectedEvents.includes(b.event_id)))-Number(Boolean(a.id===selectedSituation||a.id===selectedGoal||a.situation_id===selectedSituation&&selectedSituation||a.goal_id===selectedGoal&&selectedGoal||selectedEvents.includes(a.event_id))));
 const context=continuityContext({memories,sources,history,situations:prioritize(situations),commitments:prioritize(commitments),agenda:prioritize(agenda),goals:prioritize(goals),reviews:prioritize(reviews),memoryUses,revisions});
 prioritize(context.reviews);
 return {...context,selectedSituation,profile:context.allowLegacy?profile:null,profileItems:context.allowLegacy?profileItems:[],
  hypotheses:context.allowLegacy?hypotheses:[],people:context.allowLegacy?people:[]};
}

