# SELF-IA — incremento de beta, 13 octubre 2026

Estado: candidato para pruebas internas, no apertura de beta externa. Base inspeccionada: `93df494afaa70c9d93739bf2054f6cce8f3918df`, rama `selfia-audit-p0-onboarding`, sin cambios locales previos. El chat de referencia estaba desactualizado respecto al código del 12 de octubre.

## Cambios

- Borrado individual explícito en recuerdos activos y retirados: confirmación con alcance, cancelación, errores de red y reintento seguro. Elimina texto del recuerdo, sus versiones, aprendizaje/paso de revisión de origen y resúmenes derivados afectados. Retira el texto de propuestas anteriores de motivación, que carecen de atribución completa de dependencias. Conserva una marca sin texto y referencias para impedir reutilización. Las conversaciones y resultados originales son registros separados y se conservan; sus textos relacionados se excluyen del contexto. No equivale a supresión de toda la cuenta o copias de proveedores.
- Función privada con privilegios limitados a esa operación: identidad obligatoria, propietario explícito, control de versión, transacción y bloqueo de reactivación. Interfaz pública con SECURITY INVOKER; función privilegiada en esquema no expuesto. No se amplían permisos de edición de historiales. La migración añade comportamiento; no borra registros al aplicarse.
- Contexto del servidor excluye notas derivadas, títulos, resultados y siguientes pasos asociados a fuentes borradas; conserva estados y fechas operativas. La interfaz descarta respuestas almacenadas localmente tras el borrado, conservando borradores.
- Motivación vuelve a usar su servicio específico: cuatro necesidades, respuesta real del endpoint, valoración útil/no útil, última propuesta recuperable y errores sin sustituirla. Pedir apoyo no crea un compromiso ni agenda una acción. Las pruebas de esta ronda simulan el modelo.
- Navegación Hoy · Mi vida · SELF-IA · Evolución: historial de navegador atrás/adelante, pantalla y contexto recuperados tras recarga; nombres visibles/accesibles coherentes; separación de estado por cuenta.
- Móvil: entradas de 16px, margen inferior seguro, tarjetas de agenda adaptadas y estado vacío cuando todos los recuerdos están retirados. Un navegador emulado no certifica teclado físico iOS/Android.
- Prueba de «mañana» corregida para Europe/Madrid: UTC podía producir la fecha del día local después de medianoche. No se relajó la validación de planes.

## Evidencia de esta ronda

| Comprobación | Resultado y alcance |
|---|---|
| Node/SQL | 33 pruebas PASS, incluyendo ciclo, RLS de 22 tablas, corrección, retirada, borrado, reversión por fallo intermedio, repetición y protección entre cuentas |
| Servidor Deno | 10 PASS, proveedores simulados, ejecución sin permiso de red |
| Compilación Vite | PASS |
| Navegador React | PASS móvil 390×844 y escritorio; Auth/IA simuladas, SQL/RLS reales en PGlite; cero peticiones externas |
| HTTP borrado | PASS en Supabase de pruebas con A/B sintéticas: login real, propietario ajeno rechazado, versión vieja rechazada, borrado/reintento, historial vacío, reactivación denegada, contexto desplegado sin el texto y memorias de B idénticas |
| HTTP RLS/sesiones | PASS 22 tablas pobladas, lectura/escritura ajena y anónima, dos sesiones concurrentes, idempotencia, cierre local conserva la otra sesión y B |
| Advisors | RLS activo en las 25 tablas públicas. Sin nuevos avisos de seguridad. Dos INFO de presupuesto sin políticas son intencionados: tablas exclusivas del servidor. WARN de contraseñas filtradas sigue abierto. Tres INFO de índices sin uso: no se eliminan por falta de uso en una muestra pequeña |

Casos solicitados: propuesta sin aceptación no crea acción; revisión omitida no inventa aprendizaje; cambio de resultado conserva historia; mover conserva coherencia de agenda/compromiso; borradores y respuesta perdida conservan identidad; corrección/retirada/borrado invalidan contexto; repetir asunto conserva vínculo; conflicto de versión rechaza sobrescritura. Esto acredita comportamiento mecánico. No se ha repetido evaluación semántica con IA real ni se afirma cobertura exhaustiva de contradicciones en lenguaje natural.

## Entorno y preview

Único enlace de pruebas: https://self-ia-mobile-git-selfia-continuity-preview-self-ia.vercel.app

Backend exclusivo: `tleqdegnzeukonbbrrzk` (SELF-IA Pruebas). Usa cuentas de este entorno; no se presupone que una contraseña del backend habitual funcione aquí. No se copian usuarios, contraseñas ni datos entre proyectos. Las credenciales sintéticas del harness siguen fuera de Git y de este informe.

Migración local generada por CLI: `20261012223132_beta_memory_erasure.sql` (hora UTC). Aplicada solo en pruebas. Primer envío tuvo fallo de transporte; se comprobó ausencia de función/migración antes de repetir. Funciones activas de esta ronda: chat22, context11, daily17, motivation17; autenticación en el cuerpo de cada función, validada por tests. Discover14 y onboarding6 sin cambios.

Main observado: `a08ac1b755434516758a9abe059932b4c6a8a7bd`. No se modifica main, producción Vercel ni Supabase habitual `hhbipvgusfhpcbdifxyy`. No se contratan servicios ni se ejecutan llamadas al modelo. La publicación de interfaz se verifica después del push seguro.

## Tres tareas antes de abrir beta externa

1. **Validación final de IA y acceso al proveedor:** confirmar vigencia/renovación de la clave cuya caducidad anterior era el 13 de octubre; autorizar el consumo de una batería final y revisar semánticamente abuso, médico, menor, contradicción e inyección. No se prueba una clave llamando al modelo sin autorización de gasto.
2. **Aceptación en dispositivos y Auth reales:** teclado/retroceso y cortes reales en iOS/Android, dos dispositivos, token firmado realmente caducado y caducidad temporal de un enlace no consumido. Registro y recuperación previos son evidencia histórica, no repetida hoy; no se envían correos en esta ronda.
3. **Operación de beta externa:** acceso adulto por invitación, política y procedimiento de supresión/retención/proveedores completos, recuperación del proveedor y avisos fuera del navegador; resolver o aceptar explícitamente la limitación de protección de contraseñas sin contratar planes automáticamente.

Referencia del aviso de Auth: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
