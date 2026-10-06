import React,{useState} from 'react';
import {safeLink,localDate} from './continuity';
export function ReviewPanel({event,onSave,onCancel}){
 const [status,setStatus]=useState('done'),[result,setResult]=useState(''),[learning,setLearning]=useState(''),[next,setNext]=useState(''),[date,setDate]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [request]=useState(()=>crypto.randomUUID());
 async function save(){setSaving(true);setError('');try{
  if(status==='moved'&&(!date||new Date(date)<=new Date()))throw Error('Elige una fecha futura.');
  await onSave(event,{status,result:status==='skipped_review'?'':result,learning:status==='skipped_review'?'':learning,next:status==='skipped_review'?'':next,rescheduled:status==='moved'?new Date(date).toISOString():null,request});onCancel();
 }catch(e){setError(e.message)}finally{setSaving(false)}}
 return <section className="formCard card" aria-label="Revisar acción"><h3>{event.title}</h3><label>¿Qué ocurrió?<select value={status} onChange={e=>setStatus(e.target.value)}>
 {Object.entries({done:'Lo hice',partially_done:'Lo hice parcialmente',not_done:'No lo hice',moved:'Lo moví',no_longer_relevant:'Ya no tiene sentido',skipped_review:'Prefiero no revisarlo'}).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 {status!=='skipped_review'&&<><label>Resultado o contexto<textarea value={result} onChange={e=>setResult(e.target.value)} placeholder="Qué pasó, qué ayudó o qué lo dificultó (opcional)" maxLength={4000}/></label>
 <label>Qué quiero que SELF-IA recuerde<textarea value={learning} onChange={e=>setLearning(e.target.value)} placeholder="Un aprendizaje concreto de este intento (opcional)" maxLength={4000}/></label><small>Lo guardaré como algo que tú has declarado, referido a este intento. Podrás corregirlo.</small>
 <label>Qué probaría la próxima vez<textarea value={next} onChange={e=>setNext(e.target.value)} maxLength={4000}/></label></>}
 {status==='moved'&&<label>Nueva fecha<input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label>}
 {error&&<p role="alert">{error}</p>}<button disabled={saving} onClick={save}>{saving?'Guardando…':'Guardar revisión'}</button><button className="soft" disabled={saving} onClick={onCancel}>Cancelar</button></section>
}
export function MemoryCard({memory,onAction,onTrace}){
 const [editing,setEditing]=useState(false),[text,setText]=useState(memory.content),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const act=async(action)=>{setBusy(true);setError('');try{await onAction(memory,action,text);setEditing(false)}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <article className="memoryCard card"><small>{(['confirmed','update'].includes(memory.status)&&['confirmed','corrected'].includes(memory.user_validation))?'Validado por ti':'Pendiente de confirmar'} · {memory.memory_type==='action_learning'?'Aprendizaje de un intento':'Nota de conversación'}</small>
 {editing?<label>Corrección<textarea value={text} onChange={e=>setText(e.target.value)} maxLength={4000}/></label>:<p>{memory.content}</p>}
 <small>Registrado: {new Date(memory.created_at).toLocaleDateString('es-ES')}</small><div className="memoryActions">
 {editing?<><button disabled={busy||!text.trim()} onClick={()=>act('correct')}>Guardar corrección</button><button onClick={()=>setEditing(false)}>Cancelar</button></>:<>
 {!(['confirmed','update'].includes(memory.status)&&['confirmed','corrected'].includes(memory.user_validation))&&<button disabled={busy} onClick={()=>act('confirm')}>Confirmar</button>}
 <button disabled={busy} onClick={()=>setEditing(true)}>Corregir</button><button disabled={busy} onClick={()=>act('obsolete')}>Ya no aplica</button><button disabled={busy} onClick={()=>act('dontuse')}>No volver a usar</button></>}
 <button onClick={()=>onTrace(memory)}>Ver origen e historial</button></div>{error&&<p role="alert">{error}</p>}</article>
}
export function Planner({onDiscover,onSchedule}){
 const [vibe,setVibe]=useState('tranquilo'),[city,setCity]=useState(''),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[chosen,setChosen]=useState(null),[date,setDate]=useState(localDate()),[time,setTime]=useState('18:00'),[saved,setSaved]=useState(false);
 const discover=async()=>{setBusy(true);setError('');setChosen(null);setSaved(false);try{setData(await onDiscover({intent:'today_plan',vibe,city,country:'España',local_date:localDate()}))}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <><div className="pagehead"><div><span className="eyebrow">UN PLAN QUE ENCAJE CONTIGO</span><h1>Qué hago hoy</h1><p>Elige un ritmo. Revisa el plan y decide si quieres guardarlo.</p></div></div><section className="formCard card">
 <label>Tipo de plan<select value={vibe} onChange={e=>setVibe(e.target.value)}>{['tranquilo','social','movido','casa'].map(v=><option key={v}>{v}</option>)}</select></label>
 <label>Ciudad (opcional)<input value={city} onChange={e=>setCity(e.target.value)} placeholder="Para opciones cercanas"/></label><button disabled={busy} onClick={discover}>{busy?'Buscando…':'Buscar planes'}</button></section>
 {data&&<><p>{data.intro}</p>{data.plans?.length?data.plans.map((p,i)=><article className="card formCard" key={i}><h3>{p.title}</h3><small>{p.category} · {p.vibe}</small><p>{p.description}</p><p>{p.why}</p>{p.source_url&&safeLink(p.source_url)&&<a href={safeLink(p.source_url)} target="_blank" rel="noopener noreferrer">Consultar fuente</a>}<button onClick={()=>{setChosen(p);setSaved(false)}}>Elegir este plan</button></article>):<p>No hay propuestas verificables para esta búsqueda. Prueba otra ciudad o ritmo.</p>}</>}
 {chosen&&<section className="formCard card"><h3>{chosen.title}</h3><label>Día<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Hora<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><button disabled={busy||saved} onClick={async()=>{setBusy(true);setError('');try{await onSchedule(chosen,new Date(date+'T'+time).toISOString());setSaved(true)}catch(e){setError(e.message)}finally{setBusy(false)}}}>{saved?'Guardado en mi semana':'Guardar en mi semana'}</button></section>}
 {error&&<p role="alert">{error}</p>}</>
}

