// Fail closed for venues/events without a verified usable time window.
export function availablePlans(plans:any[],now=new Date(),todayOnly=true,timezone='Europe/Madrid') {
 const ready=now.getTime()+30*60000;
 const day=(time:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
 return plans.filter(p=>{
  try{if(new URL(p.source_url).protocol!=='https:')return false}catch{return false}
  if(p.timing_kind==='flexible')return p.requires_opening_hours===false;
  if(!['open_window','fixed_event'].includes(p.timing_kind)||p.time_verified!==true)return false;
  const zoned=/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
  if(!zoned.test(p.starts_at||'')||!zoned.test(p.ends_at||''))return false;
  const start=Date.parse(p.starts_at),end=Date.parse(p.ends_at),duration=Number(p.duration_minutes)*60000;
  if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(duration)||duration<15*60000||duration>12*3600000)return false;
  if(todayOnly&&day(Math.max(ready,start))!==day(now.getTime()))return false;
  return p.timing_kind==='fixed_event'?start>=ready&&end>=start+duration:Math.max(ready,start)+duration<=end;
 });
}
