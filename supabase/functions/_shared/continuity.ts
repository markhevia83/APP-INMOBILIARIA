export function eligibleMemories(rows: any[]) {
 return rows.filter(m=>['confirmed','update'].includes(m.status)&&['confirmed','corrected'].includes(m.user_validation));
}
export function continuityContext(data: any) {
 const blocked=data.memories.filter((m:any)=>['obsolete','do_not_store'].includes(m.status)||m.user_validation==='rejected'||m.user_validation==='corrected');
 const blockedMessages=new Set(blocked.map((m:any)=>m.source_message_id).filter(Boolean));
 const blockedEvents=new Set(blocked.map((m:any)=>m.source_event_id).filter(Boolean));
 const blockedConversations=new Set(data.sources.filter((m:any)=>blockedMessages.has(m.id)).map((m:any)=>m.conversation_id));
 for(const use of data.memoryUses||[]){if(use.memory_ids.some((id:string)=>blocked.some((m:any)=>m.id===id)))blockedConversations.add(use.conversation_id)}
 const safe=(rows:any[])=>rows.filter(x=>!blockedMessages.has(x.source_message_id)&&!blockedConversations.has(data.sources.find((m:any)=>m.id===x.source_message_id)?.conversation_id));
 const blockedMemoryIds=new Set(blocked.map((m:any)=>m.id));
 return {
  memories:eligibleMemories(data.memories).filter((m:any)=>m.user_validation==='corrected'||(!blockedMemoryIds.has(m.id)&&(m.structured_data?.review_id||(!blockedMessages.has(m.source_message_id)&&!blockedEvents.has(m.source_event_id))))).map((m:any)=>({id:m.id,updated_at:m.updated_at,content:m.content,life_area:m.life_area,
    epistemic_type:m.structured_data?.epistemic_type||'user_validated',scope:m.structured_data?.scope||'declared',
    source_message_id:m.source_message_id,source_event_id:m.source_event_id})),
  history:data.history.filter((m:any)=>!blockedConversations.has(m.conversation_id)&&!blockedMessages.has(m.id)),
  situations:safe(data.situations),goals:data.goals.filter((g:any)=>!blocked.some((m:any)=>m.source_event_id&&data.agenda.some((a:any)=>a.id===m.source_event_id&&a.goal_id===g.id))),
  commitments:safe(data.commitments),agenda:safe(data.agenda).filter((a:any)=>!blockedEvents.has(a.id)),
  reviews:data.reviews.filter((r:any)=>!blockedEvents.has(r.event_id)).map((r:any)=>({event_id:r.event_id,status:r.status,result_note:r.result_note,next_step:r.next_step,created_at:r.created_at})),
  allowLegacy:blocked.length===0
 };
}

