const uuid = value => typeof value === 'string' && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
export function authErrorMessage(error,operation='login') {
  const code=String(error?.code||''),message=String(error?.message||'');
  if(message.startsWith('Usa una contraseña de al menos')||message==='No hay conexión con SELF-IA.')return message;
  if(code==='invalid_credentials')return 'Correo o contraseña incorrectos.';
  if(code==='email_not_confirmed')return 'Confirma tu correo antes de entrar. Revisa también la carpeta de spam.';
  if(/rate_limit/.test(code)||/rate limit/i.test(message))return 'Se ha alcanzado el límite temporal de intentos o correos. Espera antes de volver a intentarlo.';
  if(/sending.*email/i.test(message)||code==='email_address_not_authorized')return 'No se ha podido enviar el correo de acceso. No necesitas cambiar tu contraseña para resolver este fallo de envío.';
  return operation==='recover'?'No se ha podido solicitar el correo de recuperación. Inténtalo más tarde.':operation==='password'?'No se ha podido actualizar la contraseña. Revisa el enlace de recuperación.':operation==='signup'?'No se ha podido completar el registro. Conserva tus datos y vuelve a intentarlo más tarde.':'No se ha podido iniciar sesión. Revisa tus datos y vuelve a intentarlo.';
}
export function mutationErrorMessage(error) {
  const value=String(error?.message||'');
  if(value.includes('schedule_conflict_use_review'))return 'Esta acción ya tiene una fecha guardada. Para cambiarla, abre «Revisar o corregir resultado» y elige «Lo moví».';
  if(/event_changed_reload|review_changed_reload|memory_changed_reload|session_changed_reload/.test(value))return 'Este registro ha cambiado en otra vista. Recarga la página y revisa su última versión antes de guardar.';
  if(value.includes('request_conflict'))return 'Esta petición ya se guardó con otros datos. Recarga la página antes de volver a cambiarla.';
  if(/plan_expired|plan_date_or_margin/.test(value))return 'El plan ha caducado o ya no da tiempo a realizarlo. Busca propuestas de nuevo.';
  if(value.includes('future_date_required'))return 'Elige una fecha y hora futuras.';
  if(value.includes('goal_context_conflict'))return 'El objetivo no corresponde a este asunto. Revisa el objetivo elegido antes de guardar.';
  if(value.includes('commitment_closed'))return 'Esta acción está cerrada. Revisa su último resultado antes de volver a programarla.';
  if(/unauthorized|permission denied|linked_record_not_found|not_found/.test(value))return 'No se puede usar este registro con tu cuenta. Recarga tus datos y vuelve a intentarlo.';
  if(/invalid_|input_too_long/.test(value))return 'Revisa los campos del formulario antes de guardar.';
  return 'No se pudo guardar el cambio. Conserva tus datos y vuelve a intentarlo.';
}
export class ProtocolError extends Error {
  constructor() { super('La respuesta llegó incompleta. Tus datos siguen en el formulario; reintenta.'); this.name = 'ProtocolError'; }
}
export async function readApiResponse(response, path, body = {}) {
  let data;
  try { data = await response.json(); } catch { if (response.ok) throw new ProtocolError(); }
  if (!response.ok) {
    const message = (data?.error?.code === 'monthly_budget' || data?.error === 'monthly_budget') ? 'El presupuesto mensual de IA está reservado o agotado. El responsable debe revisar el gasto antes de continuar.' : response.status === 429 ? 'Hay demasiadas peticiones. Espera un momento y reintenta.' :
      response.status >= 500 ? 'SELF-IA no ha podido completar la petición. Reintenta.' :
      object(data) && (data.message || data.error) || 'No se pudo completar la petición.';
    const error = new Error(message); error.status = response.status; throw error;
  }
  let valid = object(data);
  if (path === 'selfia-chat') valid &&= uuid(data.conversation_id) && uuid(data.source_message_id) && text(data.reply) &&
    (data.situation == null || object(data.situation) && uuid(data.situation.id)) &&
    (data.commitment == null || object(data.commitment) && text(data.commitment.what) && typeof data.commitment.why === 'string') &&
    (!body.onboarding || object(data.onboarding) && uuid(data.onboarding.session_id));
  else if (path === 'selfia-daily') valid &&= text(data.message) && typeof data.cta==='string' && typeof data.prompt==='string';
  else if (path === 'selfia-discover') valid &&= typeof data.intro === 'string' && Array.isArray(data.plans) && data.plans.every(p => object(p) && text(p.title) && text(p.description) && uuid(p.proposal_id) && Number.isFinite(Date.parse(p.checked_at)) && Number.isFinite(Date.parse(p.expires_at)));
  else if (path === 'selfia-motivation') valid &&= uuid(data.id) && text(data.title) && text(data.text) && ['phrase','boost','video'].includes(data.format) && (data.video_query===null || typeof data.video_query==='string');
  else if (path === 'selfia-context') valid &&= ['confirmed_memories','open_situations','pending_commitments','goals','agenda','recent_results'].every(k => Array.isArray(data[k]));
  else if (path === 'selfia-onboarding') valid &&= ['in_progress','review','completed','skipped'].includes(data.status) &&
    (body.action!=='skip' || data.status==='skipped') && (body.action!=='complete' || data.status==='completed') &&
    (!['start','answer','checkpoint'].includes(body.action) || uuid(data.session_id) && uuid(data.conversation_id) && Number.isInteger(data.revision));
  else valid = false;
  if (!valid) throw new ProtocolError();
  return data;
}
