const uuid = value => typeof value === 'string' && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
export class ProtocolError extends Error {
  constructor() { super('La respuesta llegó incompleta. Tus datos siguen en el formulario; reintenta.'); this.name = 'ProtocolError'; }
}
export async function readApiResponse(response, path, body = {}) {
  let data;
  try { data = await response.json(); } catch { if (response.ok) throw new ProtocolError(); }
  if (!response.ok) {
    const message = response.status === 429 ? 'Hay demasiadas peticiones. Espera un momento y reintenta.' :
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
