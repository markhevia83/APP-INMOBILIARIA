export const localDate = (d=new Date()) => {
 const n=new Date(d); return [n.getFullYear(),String(n.getMonth()+1).padStart(2,'0'),String(n.getDate()).padStart(2,'0')].join('-');
};
export function areaSummary(area,{situations,goals,agenda,reviews=[]},now=new Date()){
 const open=situations.filter(s=>s.life_area===area&&s.status==='open');
 const gs=goals.filter(g=>g.life_area===area&&g.status==='active');
 const events=agenda.filter(a=>a.life_area===area);
 const due=events.filter(a=>a.status==='planned'&&new Date(a.scheduled_start)<=now);
 const pending={situations:open.length,reviews:due.length,decisions:gs.filter(g=>g.progress_state==='pending_decision').length};
 const state=!open.length&&!gs.length&&!events.length?'Sin información suficiente':gs.some(g=>g.progress_state==='blocked')?'Bloqueado':open.length?'En proceso':gs.length?'Objetivos activos':'Actividad registrada';
 const recent=reviews.filter(r=>events.some(a=>a.id===r.event_id)&&new Date(r.created_at)>new Date(now.getTime()-28*86400000))
  .filter(r=>['done','partially_done','not_done'].includes(r.status));
 const latest=Array.from(new Map(recent.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(r=>[r.event_id,r])).values());
 const split=now.getTime()-14*86400000;
 const before=latest.filter(r=>new Date(r.created_at).getTime()<split),after=latest.filter(r=>new Date(r.created_at).getTime()>=split);
 const ratio=rows=>rows.reduce((n,r)=>n+(r.status==='done'?1:r.status==='partially_done'?.5:0),0)/rows.length;
 const delta=ratio(after)-ratio(before);
 const trend=before.length<2||after.length<2?'Sin información suficiente':delta>.2?'Más acciones completadas':delta<-.2?'Menos acciones completadas':'Actividad similar';
 return {state,trend,pending};
}
export function safeLink(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}}
export function reviewSummary(agenda,reviews=[]){
 const byEvent=new Map(agenda.filter(e=>e.status!=='planned').map(e=>[e.id,e]));
 for(const r of reviews.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)))byEvent.set(r.event_id,r);
 const rows=[...byEvent.values()];
 return {total:rows.length,done:rows.filter(r=>r.status==='done').length,partial:rows.filter(r=>r.status==='partially_done').length,moved:rows.filter(r=>r.status==='moved').length};
}

