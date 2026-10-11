# SELF-IA: correcciones de la auditoría del 9 de octubre

Fecha: 11 de octubre de 2026. Actualizado el 12 de octubre tras autorización y despliegue de F09. Candidato interno; **no aprobado para beta externa ni lanzamiento**.

Fuente: `auditoria-selfia-2026-10-09.txt`, SHA-256 `e9c3658e6f3cf04ed0669ad058a485bf2405c236c2edd193e240c1943194f5aa`. Este documento complementa los informes anteriores; sus resultados históricos no certifican este candidato.

## Entorno y límites

- Repositorio `markhevia83/APP-INMOBILIARIA`, rama `selfia-audit-p0-onboarding`; preview aislada desde `selfia-continuity-preview`.
- Supabase de pruebas `tleqdegnzeukonbbrrzk`. No se modificaron `main`, producción de Vercel ni Supabase `hhbipvgusfhpcbdifxyy`.
- Datos sintéticos exclusivamente para verificaciones. Las comprobaciones SQL remotas de esta entrega se ejecutaron en una transacción terminada en `ROLLBACK`.
- Los cierres de sesión de la aplicación y de los harnesses usan `scope: local`; no se revocan sesiones globales de la cuenta B.
- Una versión sin configuración explícita de Supabase queda bloqueada; se elimina la conexión implícita a producción.

## Estado de los doce hallazgos

| Hallazgo | Implementación | Evidencia y límite de cierre |
|---|---|---|
| F01 P1: resultado corregido incoherente | Todas las transiciones actualizan agenda y compromiso; omitir revisión vuelve a pendiente y excluye el aprendizaje sustituido. | SQL local: 36 combinaciones; SQL remoto de pruebas: hecho→omitir. Pendiente contraste independiente en preview. |
| F02 P1: respuesta tardía y borradores | Espacio por cuenta/asunto, generaciones de sesión, borrador y solicitud recuperables; la respuesta termina en su contexto original. | Pruebas de estados y navegador React con respuesta retenida, cambio de objetivo, borrador, navegación y recarga. Auth/IA simuladas. |
| F03 P1: otra fecha devuelve falso éxito | Repetición exacta devuelve el registro; otra fecha/área/tipo/objetivo da conflicto explícito. | SQL local y remoto; no se reprograma en silencio. |
| F04 P1: duplicados manuales | RPC transaccional con UUID, recibo por usuario, bloqueo y conflicto de payload; guardado protegido en UI. | SQL local/remoto y recuperación de respuesta perdida en navegador. Dos sesiones HTTP reales siguen bloqueadas por conectividad. |
| F05 P1: JSON 200 inválido | Contratos por endpoint; un éxito vacío o mal formado es error recuperable. Se conservan texto y UUID. | Pruebas de contratos 200/401/429/503 y respuesta rota después del commit en React. |
| F06 P1: onboarding confirma escritura fallida | Todas las transiciones y el primer turno/checkpoint son transacciones; versión y recibo de reintento; errores comprobados. | Fallo inyectado en cada escritura, snapshot antes/después y reintento; comprobación SQL remota. |
| F07 P1: recuperación y salida | Recuperación por correo, cambio de contraseña, aviso de confirmación/enlace vencido, salida local y limpieza de cuenta. | Navegador: salida, cuenta B sin datos A. **Pendiente correo real**, redirects autorizados, link caducado/reutilizado y aislamiento entre sesiones reales. No cerrado para lanzamiento. |
| F08 P2: dictado | Se reconstruyen todos los segmentos, con correcciones provisionales; limpieza de reconocimiento y aviso de permisos. | Prueba de segmentos. **Voz deshabilitada por defecto**; solo habilitar `VITE_VOICE_READY=true` después de verificar dispositivos/permisos. |
| F09 P2: retirada excluye todo el perfil | Declaraciones nuevas llevan procedencia independiente. Se corrigió además un segundo filtro del prompt que descartaba incluso esas declaraciones. | Astra reprodujo la pérdida con modelo real en chat v13. El usuario autorizó expresamente el envío del contexto relevante a OpenAI en pruebas; el arreglo está **desplegado en chat v14**. El handler pasa la prueba de declaración presente y legado/retirada excluidos. **Pendiente repetición independiente con modelo real**. El perfil antiguo sin procedencia sigue excluido. |
| F10 P2: completar/omitir y recarga inicial | Estados distintos; conversación y situación inicial persistidas atómicamente; recarga y reformulación retoman el mismo asunto. | SQL y navegador con cuenta B: primer diálogo→reformular→recargar→completar. |
| F11 P2: vigencia de planes | Propuesta inmutable creada por servidor, fuente citada, expiración 30 min, día/zona/margen de 30 min revalidados al guardar; UUID de repetición. | SQL y React: otro día, expiración, hora inválida, fuente, agenda/recarga. **Planes con horario de recinto/evento excluidos** hasta verificación independiente de disponibilidad. La cita web no certifica apertura. |
| F12 P2: contraseñas filtradas | No se rebajó protección. Supabase confirma organización `free`; advisor continúa avisando. | **Pendiente** decisión/configuración del responsable: [la función requiere Pro o superior](https://supabase.com/docs/guides/auth/password-security). No se compra ni cambia facturación automáticamente. |

También se corrigió la coherencia entre objetivo, situación y compromiso al programar: objetivo ajeno/incompatible rechazado; enlace nuevo autorizado sincronizado con la acción y su situación.

## Verificaciones ejecutadas

1. `pnpm test`: **20 pruebas**, cero fallos. PostgreSQL/PGlite, RLS por rol, atomicidad, idempotencia, retirada de memoria, correcciones, paginación de asuntos antiguos, mapa y evolución sin contar dos veces.
2. `pnpm test:e2e`: aplicación React real en 390×844 y 1366×900, SQL/RLS real en PGlite; **Auth y modelo simulados**, cero peticiones externas. Acción→agenda→resultado parcial→aprendizaje→corrección→conversación→retirada; planes estructurados; respuesta tardía; cuerpo roto tras commit; recarga; A/B; onboarding; exportación y solicitud de eliminación pendiente.
3. Deno: comprobación de los seis entrypoints; harness de acceso anónimo/JWT inválido (rechazo antes de datos/modelo); prueba del payload de búsqueda que prohíbe cargar contexto personal; prueba del handler real de chat que conserva declaraciones independientes sin recuperar contexto retirado. Supabase/modelo simulados; no equivale a JWT real por HTTP.
4. Supabase alojado: transacción sintética verificada y revertida para F01/F03/F04/F10, exportación propia y solicitud de supresión pendiente. Las **23 tablas públicas** tienen RLS. RPCs de usuario denegadas a `anon`; reserva de IA solo ejecutable por `service_role`.
5. Advisor de seguridad: únicamente F12. Avisos por claves foráneas sin índice corregidos; solo quedan avisos informativos de índices todavía no usados, conservados para evaluar con tráfico.
6. Build pasa. Vite actualizado a 7.3.7 y su esbuild a 0.28.1; instalación bloqueada por lockfile; scripts permitidos por versión exacta.
7. Escaneo de patrones de secretos: 106 blobs históricos y 54 archivos actuales, más artefactos compilados: cero coincidencias de claves privadas conocidas. **No prueba ausencia de secretos**; excluye fixtures ignorados, configuración externa y logs de proveedores.

Las pruebas actuales por HTTP contra el dominio público de Supabase no llegaron al acceso: timeout de conexión y resolución de host fallida en este entorno. El conector administrativo sí funciona. No se atribuye este bloqueo a la aplicación ni se marca como una prueba superada. No se cambió DNS, firewall ni protecciones del equipo.

Astra abrió la preview 6559f57 con su navegador e inició sesión con B; el bloqueo de conexión no aparece allí. Confirmó F09 en dos conversaciones reales y el rechazo de otra fecha de F03 en dos vistas, con repetición exacta sin duplicar. Detectó un aviso técnico de programación; el frontend nuevo ofrece la explicación y cómo mover la acción. Su prueba REST por comandos también quedó bloqueada (conexión rechazada antes del servicio); entrada por navegador no certifica REST/JWT. La revisión quedó esperando una aprobación en ese chat; no se suplanta la decisión del usuario. No hay informe final de cierre independiente para esta entrega.

El despliegue aislado 6559f57 (`dpl_6Wf96NFhhSTZuxLgFe51eFRURY4E`) estaba READY; el conector Vercel obtuvo HTTP200 del índice y `/assets/index-BpVtvXpk.js`. El bundle vincula `tleqdegnzeukonbbrrzk`, compila la voz deshabilitada y contiene los contratos nuevos. Estas comprobaciones de artefacto no sustituyen el recorrido interactivo. El navegador solicitado en Codex devolvió `queued`, no evidencia de pantalla renderizada.

## Privacidad y operación: implementado y pendiente

- Exportación JSON en una instantánea SQL de datos propios, incluyendo procedencia e historiales. No exporta secretos, credenciales de Auth o cuentas ajenas.
- Solicitud de supresión registrada una sola vez como `pending`. La pantalla dice expresamente que los datos **todavía no están borrados**. No hay borrado real en esta entrega.
- Falta procedimiento ejecutable y verificado de supresión integral: Auth, relaciones, versiones, archivos, copias, retención y proveedores; identificar responsable y acceso seguro. Registrar ejecución/confirmación antes de prometer supresión.
- `store:false` en peticiones de IA. Esto no garantiza retención cero del proveedor; revisar condiciones efectivas y comunicar tratamiento antes de beta.
- Buscador de planes: solo ciudad y tipo de búsqueda explícitos; sin leer ni enviar perfil, memoria, asuntos o feedback. UI informa de OpenAI y consulta web; handler comprueba minimización.
- Registro operativo sin texto íntimo: UUID, endpoint, modelo, tokens, llamadas web, duración y resultado; límites de concurrencia/reintento/cuota en servidor antes de llamar al proveedor.
- Límites iniciales: 2 solicitudes simultáneas por cuenta, 10 globales; 40 intentos diarios por cuenta, 200 globales; 1.000 unidades reservadas al día, máximo 200 por petición, máximo 3 intentos de UUID. Unidades conservadoras de capacidad, **no euros ni techo financiero garantizado**. Faltan presupuesto efectivo del proveedor, alertas entregadas, ensayos de abuso/tráfico y ajuste de límites.
- La clave de pruebas figura históricamente con caducidad **13-10-2026**: verificar vigencia y rotación con el responsable; no se leyó ni se publica su valor.

## Pendientes completos antes de beta externa

| ID | Prioridad | Condición verificable para cerrar |
|---|---|---|
| AUTH-REAL | P1 | Registro con confirmación, correo de recuperación, redirect exacto, contraseña nueva, links vencido/reutilizado y dos sesiones reales; F07. |
| F09-VERIFY | P2 | Autorización explícita y despliegue completados el 12-10-2026: chat v14, hash `ce0a35c31ec1acfe1dff41b9cf37666aedb69ca9f173f2fa3c48d0eaec8b8f81`. Repetir con B/modelo real declaración independiente, corrección y retirada. No dar por cerrado con el test simulado. |
| PREVIEW-E2E | P1 | Release exacta, navegación móvil/escritorio y ciclo completo con red/SQL concordantes, modelo real, recarga; revisión independiente de F01–F12 y regresiones nuevas. |
| R01-MODEL | P1 | Corrección/retirada seguida de recomendaciones, resumen, paráfrasis y nuevas declaraciones independientes en varios turnos con modelo real; conservar hechos independientes. |
| R02-VOLUME | P2 | Asuntos/objetivos/acciones fuera de páginas recientes recuperados; seleccionar acción concreta ante contexto grande; validar carga y límites con cuentas voluminosas. |
| R03-HTTP | P1 | Todas las tablas por REST, lectura/escritura/vínculos A/B y anon; seis funciones con JWT válido/inválido/caducado, manipulación de IDs y prompt injection. |
| R04-CONCURRENT | P1 | Dos dispositivos/sesiones, pulsaciones simultáneas, cortes antes/después del commit, conflictos de versión y reintento sin duplicados. Harness preparado; ejecución HTTP pendiente. |
| R05-SECRETS | P1 | Revisar configuración/logs/artefactos externos e historial accesible; rotar una credencial si hay evidencia de exposición, sin publicar valores. |
| PRIVACY | Lanzamiento | Información de IA/proveedores, finalidad/base jurídica, categorías sensibles, conservación, ejercicio efectivo de derechos y revisión profesional proporcional/EIPD si corresponde. Documento técnico no certifica cumplimiento. |
| ERASURE | Lanzamiento | Tramitación segura de cola, supresión sintética completa y política de copias/retención verificada; no borrar datos reales durante auditoría. |
| SAFETY | Lanzamiento | Batería supervisada de crisis, abuso, dependencia e ideas delirantes; adultos, límites claros, respuestas útiles/no culpabilizadoras y ayuda pertinente. Un prompt/disclaimer no basta. |
| OPERATIONS | Lanzamiento | Presupuesto monetario real, alertas de gasto/error/latencia entregadas, soporte responsable, incidentes y ciclo de claves comprobados. |
| RESTORE | Lanzamiento | Ensayo aislado de restauración y reversión conjunta de frontend/Edge/esquema, con preservación de datos y compatibilidad entre versiones; ver procedimiento abajo. |
| F12-AUTH-POLICY | P2 | Protección filtrada habilitada y verificada en plan compatible, o alternativa de acceso configurada y auditada; no sustituir por longitud mínima de cliente. |
| VOICE | Excluida | Permisos denegados, stop/resume, segmentos y varios dispositivos antes de habilitar. |
| TIMED-PLANS | Excluida | Horarios/fuentes oficiales verificados por servidor y al guardar; hasta entonces no ofrecer recintos/eventos con horario. |
| BETA | Posterior | Cero P0/P1 abiertos, límites residuales aceptados, revisión independiente; después 20–30 adultos por invitación, soporte/observación antes de mercado general. |
| DESIGN | Última fase | Estética después de estabilidad, coherencia y gates anteriores; no ha bloqueado las reparaciones funcionales. |

## Procedimiento de release y recuperación

1. Consultar `audit-release-2026-10-11.json`: mismo commit en ambas ramas seguras, Edge versiones/hashes, migraciones y backend aislado. Comprobar binding de bundle a pruebas y estado READY de la preview.
2. Ejecutar pruebas locales y de endpoints; ejecutar harnesses HTTP/modelo solo contra el proyecto de pruebas. Fixtures sintéticos ignorados, cierre local. No sustituir una prueba bloqueada por un PASS.
3. Para un ensayo de recuperación, usar otro entorno aislado o snapshots sintéticos de PGlite; capturar filas/relaciones y contratos antes/después, generar nuevo resultado identificable. No restaurar la base compartida de pruebas mientras Astra use B.
4. Revertir frontend/Edge como una unidad compatible. Las migraciones son aditivas; conservar tablas/columnas e historiales y usar una migración correctiva hacia delante si hace falta. No eliminar datos ni ejecutar un down destructivo.
5. El frontend anterior a esta entrega contiene P1 conocidos: volver a él es contención técnica, **no una release aprobada**. Revertir solo Vercel no revierte Edge ni esquema.
6. Publicación queda pendiente de resultados independientes y aceptación concreta de los riesgos residuales. PR sigue sin fusionar; ninguna producción se promueve desde este procedimiento.

No se afirma que se hayan encontrado todos los errores ni que la aplicación sea perfecta. Se registran por separado implementación, evidencia ejecutada y cobertura pendiente.
