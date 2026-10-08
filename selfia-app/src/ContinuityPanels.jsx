import React,{useRef,useState} from 'react';
import {safeLink,localDate,futureSchedule} from './continuity';
export const RESULT_LABELS={done:'Lo hice',partially_done:'Lo hice parcialmente',not_done:'No lo hice',moved:'Lo moví',no_longer_relevant:'Ya no tiene sentido',skipped_review:'Prefiero no revisarlo'};
export const MEMORY_LABELS={correct:'Corrección',confirm:'Confirmado por ti',dontuse:'No volver a usar',obsolete:'Ya no aplica',confirmed:'Confirmado por ti',update:'Actualizado',candidate:'Pendiente de confirmar',do_not_store:'No volver a usar'};
export const GOAL_LABELS={active:'Activo',paused:'En pausa',completed:'Completado',abandoned:'Ya no encaja',starting:'Empezando',progressing:'Avanzando',stable:'Estable',needs_attention:'Necesita atención',blocked:'Bloqueado',changing:'En cambio',pending_decision:'Pendiente de decisión',improving:'Mejorando'};
const localInput=date=>{const d=new Date(date);return localDate(d)+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
export function ReviewPanel({event,previous,initialLearning='',history=[],onSave,onCancel}){
 const [mode,setMode]=useState(previous?'correct':'new');
 const [status,setStatus]=useState(previous?.status||'done'),[result,setResult]=useState(previous?.result_note||''),[learning,setLearning]=useState(initialLearning),[next,setNext]=useState(previous?.next_step||''),[date,setDate]=useState(previous?.rescheduled_start?localInput(previous.rescheduled_start):''),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const pending=useRef(null),inFlight=useRef(false);
 function changeMode(value){setMode(value);setStatus(value==='correct'?previous.status:'done');setResult(value==='correct'?previous.result_note||'':'');setLearning(value==='correct'?initialLearning:'');setNext(value==='correct'?previous.next_step||'':'');setDate(value==='correct'&&previous.rescheduled_start?localInput(previous.rescheduled_start):'');setError('')}
 async function save(){if(inFlight.current)return;inFlight.current=true;setSaving(true);setError('');try{
  if(status==='moved'&&(!date||new Date(date)<=new Date()))throw Error('Elige una fecha futura.');
  const payload={status,result:status==='skipped_review'?'':result,learning:status==='skipped_review'?'':learning,next:status==='skipped_review'?'':next,rescheduled:status==='moved'?new Date(date).toISOString():null,review_id:mode==='correct'?previous.id:null};
  const signature=JSON.stringify(payload);if(pending.current?.signature!==signature)pending.current={signature,request:crypto.randomUUID()};
  await onSave(event,{...payload,request:pending.current.request});onCancel();
 }catch(e){setError(e.message)}finally{inFlight.current=false;setSaving(false)}}
 return <section className="formCard card" aria-label="Revisar acción"><h3>{event.title}</h3>{event.notes&&<p>{event.notes}</p>}{safeLink(event.source_url)&&<a href={safeLink(event.source_url)} target="_blank" rel="noopener noreferrer">Consultar fuente del plan</a>}{previous&&<><label>Tipo de revisión<select value={mode} disabled={saving} onChange={e=>changeMode(e.target.value)}><option value="correct">Corregir el último resultado</option><option value="new">Registrar un nuevo intento</option></select></label><p>{mode==='correct'?'Se conserva la versión anterior. El aprendizaje de esa revisión será sustituido por lo que guardes ahora.':'Este intento se añade al historial; no corrige el anterior.'}</p></>}<label>¿Qué ocurrió?<select disabled={saving} value={status} onChange={e=>setStatus(e.target.value)}>
 {Object.entries(RESULT_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 {status!=='skipped_review'&&<><label>Resultado o contexto<textarea disabled={saving} value={result} onChange={e=>setResult(e.target.value)} placeholder="Qué pasó, qué ayudó o qué lo dificultó (opcional)" maxLength={4000}/></label>
 <label>Qué quiero que SELF-IA recuerde<textarea disabled={saving} value={learning} onChange={e=>setLearning(e.target.value)} placeholder="Un aprendizaje concreto de este intento (opcional)" maxLength={4000}/></label><small>Lo guardaré como algo que tú has declarado, referido a este intento. Podrás corregirlo.</small>
 <label>Qué probaría la próxima vez<textarea disabled={saving} value={next} onChange={e=>setNext(e.target.value)} maxLength={4000}/></label></>}
 {status==='moved'&&<label>Nueva fecha<input disabled={saving} type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label>}
 {error&&<p role="alert">{error}</p>}<button disabled={saving} onClick={save}>{saving?'Guardando…':'Guardar revisión'}</button><button className="soft" disabled={saving} onClick={onCancel}>Cancelar</button>{history.length>0&&<details><summary>Historial de resultados ({history.length})</summary>{history.map(r=><article key={r.id}><small>{new Date(r.created_at).toLocaleString('es-ES')} · {r.supersedes_id?'Corrección':'Intento registrado'}</small><p>{RESULT_LABELS[r.status]}</p>{r.result_note&&<p>Resultado: {r.result_note}</p>}{r.learning&&<p>Declaración de este intento: {r.learning}</p>}{r.next_step&&<p>Siguiente paso: {r.next_step}</p>}</article>)}</details>}</section>
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
 {data&&<><p>{data.intro}</p>{data.plans?.length?data.plans.map((p,i)=><article className="card formCard" key={i}><h3>{p.title}</h3><small>{p.category} · {p.vibe}</small><p>{p.description}</p><p>{p.why}</p>{p.source_url&&safeLink(p.source_url)&&<a href={safeLink(p.source_url)} target="_blank" rel="noopener noreferrer">Consultar fuente</a>}<button onClick={()=>{setChosen(p);setSaved(false);const next=futureSchedule();setDate(next.date);setTime(next.time)}}>Elegir este plan</button></article>):<p>No hay propuestas verificables para esta búsqueda. Prueba otra ciudad o ritmo.</p>}</>}
 {chosen&&<section className="formCard card"><h3>{chosen.title}</h3><label>Día<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Hora<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><button disabled={busy||saved} onClick={async()=>{setBusy(true);setError('');try{await onSchedule(chosen,new Date(date+'T'+time).toISOString());setSaved(true)}catch(e){setError(e.message)}finally{setBusy(false)}}}>{saved?'Guardado en mi semana':'Guardar en mi semana'}</button></section>}
 {error&&<p role="alert">{error}</p>}</>
}

