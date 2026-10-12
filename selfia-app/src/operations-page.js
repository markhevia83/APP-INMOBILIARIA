import {createClient} from '@supabase/supabase-js';
const cfg=import.meta.env,url=cfg.VITE_SUPABASE_URL||'',key=cfg.VITE_SUPABASE_PUBLISHABLE_KEY||cfg.VITE_SUPABASE_ANON_KEY;
const status=document.querySelector('#status'),metrics=document.querySelector('#metrics'),alerts=document.querySelector('#alerts');
document.body.style.cssText='font:17px system-ui;background:#f4fbff;color:#143044;padding:24px;max-width:760px;margin:auto';
let busy=false;const sb=url==='https://tleqdegnzeukonbbrrzk.supabase.co'&&key?createClient(url,key):null;
function text(parent,tag,value){const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;}
async function check(drill=false){
 if(busy)return;busy=true;
 try{
  if(!sb)throw Error('Este panel solo está conectado en pruebas.');
  const r=await sb.auth.getSession();if(r.error||!r.data.session)throw Error('Entra primero en SELF-IA con la cuenta del responsable.');
  const response=await fetch(url+'/functions/v1/selfia-operations',{method:'POST',headers:{apikey:key,authorization:'Bearer '+r.data.session.access_token,'content-type':'application/json'},body:JSON.stringify({drill})});
  const data=await response.json();if(!response.ok)throw Error(response.status===403?'Esta cuenta no tiene acceso al panel del responsable.':'No se pudo comprobar el estado.');
  status.textContent=drill?'Prueba de avisos; no es un incidente real.':'Estado actualizado: '+new Date(data.checked_at).toLocaleString('es-ES');
  if(!drill){metrics.replaceChildren();const b=data.budget;const money=x=>(Number(x)/1000000).toFixed(2)+' US$';text(metrics,'p','Mes: '+data.month+' · Límite: '+money(b.cap_microusd));text(metrics,'p','Estimado liquidado: '+money(b.spent_microusd)+' · Reservado: '+money(b.held_microusd));text(metrics,'p','Últimos 20 minutos: '+data.recent.requests+' solicitudes · '+data.recent.failures+' fallos');}
  alerts.replaceChildren();text(alerts,'h2',drill?'Avisos de prueba':'Avisos');
  if(!data.alerts.length)text(alerts,'p','No hay avisos activos en esta comprobación.');
  for(const a of data.alerts){const e=text(alerts,'p',a.message);e.setAttribute('role','alert');e.style.fontWeight=a.level==='urgent'?'700':'400';}
 }catch(e){status.textContent=e.message;metrics.replaceChildren();alerts.replaceChildren();}finally{busy=false;}
}
document.querySelector('#refresh').addEventListener('click',()=>check());document.querySelector('#drill').addEventListener('click',()=>check(true));
check();const timer=setInterval(()=>check(),60000);window.addEventListener('pagehide',()=>clearInterval(timer));
