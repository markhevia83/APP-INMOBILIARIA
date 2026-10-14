export function operationAlerts(s:any,now=Date.now()) {
 if(!s?.budget||!s?.recent)throw Error('invalid_operations_snapshot');
 const alerts:{level:string;code:string;message:string}[]=[];
 const add=(level:string,code:string,message:string)=>alerts.push({level,code,message});
 const amount=Number(s.budget.spent_microusd)+Number(s.budget.held_microusd),cap=Number(s.budget.cap_microusd);
 if(!Number.isFinite(amount)||!Number.isFinite(cap)||cap!==75000000||amount<0)throw Error('invalid_budget_snapshot');
 if(s.budget.blocked||amount>=cap)add('urgent','budget_blocked','El presupuesto mensual está bloqueado o agotado. Revisa el gasto antes de permitir más uso.');
 else if(amount>=cap*.8)add('warning','budget_80','Se ha utilizado o reservado al menos el 80 % del presupuesto mensual.');
 if(s.daily_capacity){const d=s.daily_capacity;if(Number(d.units_used)>=Number(d.units_limit)*.8||Number(d.calls_used)>=Number(d.calls_limit)*.8)add('warning','daily_capacity','Se ha consumido al menos el 80 % del cupo diario. Algunas peticiones pueden quedar bloqueadas hasta las 00:00 UTC, aunque quede presupuesto mensual.');}
 if(Number(s.recent.failures)>=3)add('urgent','provider_failures','Hay al menos tres respuestas fallidas en veinte minutos. Revisa el servicio.');
 if(Number(s.recent.stale_in_progress)>0||Number(s.unsettled_reservations)>0)add('warning','stale_requests','Hay solicitudes o reservas pendientes que necesitan revisión. No liberes gasto incierto sin comprobarlo.');
 if(Number(s.uncertain_reservations)>0||s.budget.uncertain_usage)add('warning','uncertain_cost','Hay gasto reservado con consumo no confirmado. Contrástalo con el proveedor.');
 if(Number(s.recent.p95_duration_ms)>60000)add('warning','slow_responses','Las respuestas recientes están tardando más de un minuto.');
 if(now>=Date.parse('2026-11-11T00:00:00Z'))add('urgent','pricing_review','La revisión de tarifas ha vencido. El uso de IA queda protegido por el bloqueo del servidor.');
 return alerts;
}
