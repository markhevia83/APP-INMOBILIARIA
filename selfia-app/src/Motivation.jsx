import React,{useEffect,useRef,useState} from 'react';
import {ChatText} from './ChatText';

export function Motivation({onLoad,onGenerate,onRate,onTalk}){
 const [kind,setKind]=useState('start'),[proposal,setProposal]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const inFlight=useRef(false),generation=useRef(0);
 useEffect(()=>{let active=true;const version=generation.current;onLoad().then(row=>{if(active&&generation.current===version)setProposal(row)}).catch(()=>{if(active&&generation.current===version)setError('No se pudo recuperar tu última propuesta.');});return()=>{active=false;generation.current++}},[]);
 async function generate(){
  if(inFlight.current)return;inFlight.current=true;const version=++generation.current;setBusy(true);setError('');
  try{const result=await onGenerate(kind);if(version===generation.current)setProposal(result)}
  catch{if(version===generation.current)setError('No se pudo obtener una nueva propuesta. Tu propuesta anterior se conserva. Puedes volver a intentarlo más tarde o hablar con SELF-IA.');}
  finally{if(version===generation.current)setBusy(false);inFlight.current=false;}
 }
 async function rate(rating){
  if(inFlight.current||!proposal)return;inFlight.current=true;const version=generation.current;setBusy(true);setError('');
  try{await onRate(proposal.id,rating);if(version===generation.current)setProposal(p=>({...p,rating}));}
  catch{if(version===generation.current)setError('No se pudo guardar tu valoración. Inténtalo cuando recuperes la conexión.');}
  finally{if(version===generation.current)setBusy(false);inFlight.current=false;}
 }
 return <><div className="pagehead"><span className="eyebrow">UN EMPUJÓN CON SENTIDO</span><h1>Motivación</h1><p>Elige qué necesitas. Puedes pedir apoyo sin comprometerte a actuar.</p></div>
 <section className="card formCard"><label>Qué necesito ahora<select value={kind} disabled={busy} onChange={e=>setKind(e.target.value)}><option value="start">Necesito arrancar</option><option value="stuck">Estoy bloqueado</option><option value="low">Necesito ánimo</option><option value="prepare">Prepararme para algo</option></select></label><button disabled={busy} onClick={generate}>{busy?'Un momento…':'Pedir motivación'}</button></section>
 {proposal?<section className="card formCard" aria-label="Tu propuesta de motivación"><h2>{proposal.title||'Tu última propuesta'}</h2><ChatText text={proposal.text}/><div className="memoryActions"><button disabled={busy} aria-pressed={proposal.rating===1} onClick={()=>rate(1)}>Me ayuda</button><button disabled={busy} aria-pressed={proposal.rating===-1} onClick={()=>rate(-1)}>No me ayuda</button></div><p>No se añade ninguna acción a tu agenda por pedir motivación.</p></section>:<p>Todavía no tienes una propuesta de motivación guardada.</p>}
 {error&&<p role="alert">{error}</p>}<button className="bigCta" onClick={onTalk}>Hablar con SELF-IA sobre cómo estoy hoy</button></>;
}
