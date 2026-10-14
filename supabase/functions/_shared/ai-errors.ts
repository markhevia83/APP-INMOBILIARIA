// Return only our own public codes and wording, never provider bodies or exceptions.
export function safeAiError(status:number,code:unknown) {
 const known=new Set(['monthly_budget','usage_limit','user_daily_limit','global_daily_budget','global_daily_limit','concurrency_limit','retry_limit','request_already_running_or_completed','user_concurrency','global_concurrency','capacity_limit','pricing_review_required','usage_guard_unavailable','context_too_large','provider_timeout']);
 const error=typeof code==='string'&&known.has(code)?code:'provider_error';
 const daily=['user_daily_limit','global_daily_budget','global_daily_limit'].includes(error);
 const message=error==='monthly_budget'?'El presupuesto mensual de IA está reservado o agotado. El responsable debe revisar el gasto antes de continuar.':daily?'Se ha alcanzado el límite diario de IA. Se restablece a las 00:00 UTC. Conserva tu texto para continuar después.':error==='retry_limit'?'Esta petición ha agotado sus intentos. Conserva tu texto y revisa el estado antes de crear otra.':status===429?'Has alcanzado un límite temporal de uso. Espera antes de reintentar.':status===413?'Este asunto es demasiado largo. Elige una acción concreta para continuar.':'No se pudo completar la respuesta de SELF-IA. Conserva tu texto y reintenta más tarde.';
 return {error,message,status:status===429?429:status===413?413:502};
}
