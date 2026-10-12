# SELF-IA: cierre verificado y pendientes de beta

Estado: candidato interno. No se autoriza apertura externa ni producción. Código de esta ronda: `fc6b766c8ae12a258bc1697779370028fab42af2`, ramas `selfia-audit-p0-onboarding` y `selfia-continuity-preview`, Supabase `tleqdegnzeukonbbrrzk`.

## Cerrado en esta ronda

- Panel privado `/operations.html`: autorización expresa del responsable; Auth valida su identidad en el servidor y compara el UUID configurado allí. Solo devuelve agregados monetarios, errores, duración y avisos; no conversaciones ni cambios de límites. Acceso real del responsable comprobado; anónimo/token inválido HTTP401, cuenta A no autorizada HTTP403 tanto en estado como simulacro; RPC privado rechazado al cliente.
- Avisos visibles mientras el panel está abierto: presupuesto al 80 %, fallos, lentitud, gasto incierto y cupo diario. Simulacro real en el navegador entrega tres avisos etiquetados PRUEBA DE AVISO, separado de incidentes y sin modificar gasto. No se certifica entrega fuera del navegador.
- Borrado real mediante Auth Admin: cuenta nueva `selfia-erasure-…@example.invalid` poblada en las 22 tablas; preflight, revocación de sus propias sesiones, borrado, ausencia de filas/identidad y rechazo de escritura con identidad antigua. Las 22 tablas B permanecen idénticas; A conserva su sesión. Cero cuentas desechables pendientes, cero buckets/objetos existentes. No borrado de datos reales. El endpoint de prueba solo admite A sintética y crea su propio destino; rechaza IDs suministrados, personas reales y cualquier otro proyecto. La solicitud de supresión de usuarios reales sigue pendiente, no se anuncia como ejecutada.
- Errores de cuatro funciones IA: cuerpos privados del proveedor y excepciones no llegan al cliente ni se persisten como respuestas. JSON malformado devuelve error seguro. Bloqueos monetarios/diarios quedan identificados; el cliente explica el restablecimiento diario a 00:00 UTC.
- Responsable y contacto expresamente confirmados y publicados en `/privacy.html`: MARCO ANTONIO HEVIA LOPEZ, persona física, España, markhevia@gmail.com. Página enlazada desde acceso y Tus datos. Información del funcionamiento actual con pendientes legales explícitos; no se presenta como política completa aprobada para lanzamiento.

## Evidencia y límites

32 pruebas Node pasan; 10 pruebas Deno pasan; build y recorrido React móvil/escritorio pasan. El recorrido usa Auth/modelo simulado y SQL/RLS real e incluye bloqueo de crisis por cuota, borrador conservado, ayuda urgente visible sin conexión y sin nuevas memorias/turnos. Pruebas HTTP reales separadas del panel y supresión pasan. Restauración previa en PGlite no equivale a restaurar el proveedor.

Primera batería sintética con IA real: siete escenarios pasaron controles mecánicos; revisión detectó uso de teléfonos sin país confirmado. Tras corregirlo, crisis inmediata, dependencia, creencia no corroborada y abuso pasan, sin teléfono inferido, sin recuerdo de crisis ni compromiso de productividad en el caso inmediato. La nueva ejecución se detuvo en el caso médico por cupo diario; médico, menor e inyección de contexto necesitan repetirse en la versión final y revisión semántica independiente. Son muestras de auditoría, no certificación clínica ni búsqueda exhaustiva de todos los fallos.

Capacidad real observada: 974/1000 unidades y 52 peticiones diarias, con gasto estimado 2,38 USD y cero reservas pendientes. El bloqueo diario es independiente del presupuesto mensual de 75 USD. No se modificaron límites para eludirlo. Estos valores son una observación puntual, no factura.

El servicio de despliegue devolvió errores internos. Se verificó compilación y se usó un empaquetado reproducible alternativo para chat, motivación y prueba de borrado; operación se desplegó con sus dos fuentes unidas en un único index.ts. La causa externa exacta no está confirmada. `bundle-test-functions.mjs` no carga secretos ni despliega. El manifiesto registra versiones y hashes activos; cambios de secrets pueden incrementar versiones sin cambiar el bundle.

## Pendientes antes de abrir a diez participantes

2. Caducidad temporal real de un enlace no utilizado. Registro nuevo con Gmail, confirmación, entrada por contraseña y rechazo de reutilización ya pasan; también recuperación real. No equivalen a caducidad por tiempo.
3. JWT firmado realmente caducado, cortes de red real y dos dispositivos, repetición de los tres escenarios pendientes, revisión independiente y acceso adulto por invitación. No tratar un token inventado como caducado ni el rechazo del modelo a un menor como control de entrada.
4. Política legal completa: base jurídica, datos sensibles, plazos de conservación, proveedores/transferencias y copias; procedimiento operativo para solicitudes de personas reales. La prueba de borrado no acredita retención/copia de proveedores ni borrado de archivos cuando se incorpore Storage.
5. Avisos fuera del navegador, contraste de estimaciones con facturación y recuperación/reversión del proveedor. Protección contra contraseñas filtradas sigue desactivada en el plan actual; no contratar planes ni reducir otras protecciones.

Urgente adicional: metadatos de la clave «SELF-IA Pruebas» verificados el 12 de octubre indican caducidad el 13 de octubre de 2026. Renovación no realizada ni asumida; no se leyó/copió su valor. No aumentar gasto ni reutilizar claves de otros proyectos.

Estética permanece para el final. Main, producción de Vercel y Supabase `hhbipvgusfhpcbdifxyy` intactos.

Revisión independiente final del onboarding: Astra turno `01a131bd-82c8-7c91-9c80-4cdd0437ecb5`, dos pruebas seleccionadas y reproducción local pasan: una petición inicial y ningún reenvío tras recarga; edición explícita permite una nueva petición. Preview fc6b766 READY. No modelo ni modificación de B. Este P2 queda cerrado en esa cobertura; el despliegue del nuevo chat y la caducidad temporal siguen pendientes.

## Segunda revisión de Astra y correcciones

Turno independiente `01a131a0-9623-7cb1-aed6-3aa2cfffae33`: P1, ayuda de crisis ausente cuando se deniega el modelo; P1, consejo de cambiar claves/ubicación en abuso sin valorar alerta al agresor; P2, reintento confuso después de agotar intentos. No aprobación de beta.

Ayuda urgente incorporada al acceso, onboarding y aplicación como contenido local desplegable, sin modelo ni cuota. El cliente añade ayuda inmediata a los errores del chat; la prueba del navegador confirma que funciona con cuota denegada y la conexión cortada. Los intentos terminales mantienen borrador e identidad de petición y no se recrean automáticamente, incluso tras recarga. Ambas correcciones pasan pruebas locales.

Reglas sobre tecnología en abuso condicionan cambios de cuentas/localización a un plan de seguridad y al riesgo de escalada, incluso con otro dispositivo. Fundamento: [Safety Net, Technology Safety Plan](https://www.techsafety.org/resources-survivors/technology-safety-plan). La orientación urgente pide apoyo humano/emergencias sin presumir país; [NHS, Urgent support](https://www.nhs.uk/every-mind-matters/urgent-support/) respalda la necesidad de ayuda inmediata, no un número aplicable globalmente.

Daily16 y motivation16 incluyen estas nuevas reglas. **El despliegue del chat actualizado sigue rechazado por errores internos de Supabase; chat20 continúa activo con el paquete anterior.** No declarar el consejo del modelo corregido en vivo ni el campo server-side support_message activo todavía. La ayuda del cliente es independiente de ese despliegue. Queda desplegar y volver a comprobar chat, repetir el caso de abuso y completar la revisión independiente en la versión final sin eludir el cupo.


Astra validó independientemente ayuda local sin sesión y errores/reintentos del chat (3/3), pero encontró la vía de onboarding. Reparada en fc6b766: prueba de navegador con una sola petición fallida, ninguna repetición antes/después de recarga, borrador conservado; edición explícita continúa el flujo. Unit tests cubren vacío intencional, respuesta tardía y cambio de cuenta. Full32 Node pasa en b62a14f; ese commit corrige solo un fixture que podía exceder por1ms el máximo30min (dos lecturas de reloj). Producción ya usa un solo instante; no se cambió la protección SQL. Revisión independiente final solicitada.
