# SELF-IA: verificación ampliada del 12 de octubre

Estado: candidato interno. Beta externa todavía no aprobada. Solo ramas seguras, preview y Supabase `tleqdegnzeukonbbrrzk`; producción intacta.

## Evidencia ejecutada

- 32 pruebas locales superadas, build y ciclo React móvil/escritorio superados.
- Acceso HTTP real recuperado: dos sesiones de A crean simultáneamente el mismo compromiso sin duplicarlo; reutilizar el UUID con otro contenido queda rechazado. Cerrar una sesión local conserva la otra y la cuenta B.
- REST/RLS real: las 22 tablas con propietario están pobladas y verificadas. B no lee ni actualiza filas de A, no inserta usando el propietario A; anónimos no leen contenido ni insertan. Las dos tablas de presupuesto del servidor permanecen privadas. SELECT anónimo puede responder 200 con lista vacía: eso no es una fuga.
- Seis funciones desplegadas rechazan solicitudes anónimas y tokens inválidos antes del modelo.
- Ciclo con Auth, base de datos y modelo reales: situación, acción aceptada, agenda, resultado parcial, aprendizaje declarado, memoria corregida, conversación adaptada, retirada y conversación posterior. Planes estructurados y rechazo de IDs ajenos comprobados. Cobertura semántica limitada a los escenarios del harness.
- Restauración aislada: dump y carga de una base sintética PGlite; igualdad de las 25 tablas, aislamiento A/B, corrección y retirada conservadas, repetición sin duplicado, reserva monetaria conservada. No se ha restaurado la base compartida ni se certifica recuperación del proveedor.

## Reparación de supresión

Nueve relaciones con Auth impedían borrar completamente una cuenta. La migración `20261012170045_beta_erasure_cascade.sql` cambia sus claves foráneas a CASCADE; las 22 tablas con propietario quedan cubiertas. Aplicada únicamente en pruebas como `20261012170608_beta_erasure_cascade`. Aplicar la migración no borra ninguna fila.

El preflight es exclusivo del servidor. Comprueba solicitud pendiente, cobertura del esquema, relaciones entre propietarios y archivos antes de permitir continuar. Se conservan los agregados monetarios globales: borrar una cuenta no devuelve gasto disponible.

Prueba local completa con fixtures de las 22 tablas: supresión de A sintética, B idéntica, identidad antigua sin acceso y presupuesto conservado. Prueba alojada de preflight/cascada dentro de una transacción revertida con una cuenta desechable nueva. Ningún dato real fue borrado.

El prototipo `selfia-app/scripts/test-erasure.mjs` usa la API oficial de Auth Admin y exige credencial de pruebas en entorno seguro. Por defecto solo hace preflight. Rechaza correos reales y las cuentas de auditoría; ejecutar requiere repetir el UUID exacto y una cuenta `selfia-erasure-…@example.invalid`. Aún falta ejecutar esa API con una cuenta desechable, verificar archivos, sesiones, retención y copias. La pantalla mantiene la solicitud como pendiente: no promete supresión realizada.

## Acceso y continuidad de IA

Errores de acceso/registro/recuperación ahora muestran mensajes españoles útiles. Un fallo de envío explica que cambiar la contraseña de SELF-IA no arregla SMTP. Registro incorpora el origen como redirect; usar el alias estable autorizado para probar confirmación.

El 12 de octubre se consultó el panel de OpenAI con autorización humana limitada a metadatos: **SELF-IA Pruebas, activa, caduca el 13 de octubre de 2026**. No se reveló, copió ni modificó su valor. Renovación pendiente del responsable antes de esa fecha. No reutilizar automáticamente otras claves.

## Cuatro bloques que todavía impiden abrir la beta

1. **Acceso real:** Gmail entrega recuperación, cambio de contraseña/entrada y rechazo de enlace consumido pasan. El rechazo IONOS535 anterior quedó sustituido por el proveedor aprobado. Registro/confirmación y entrada real nuevos con Gmail ya pasan; caducidad temporal de enlace no usado sigue pendiente.
2. **Seguridad y comportamiento:** ampliar JWT firmado caducado, manipulación/inyección, volumen, dos dispositivos y cortes reales de red. Batería supervisada de crisis, abuso, dependencia e ideas delirantes; acceso adulto por invitación y revisión independiente.
3. **Privacidad efectiva:** completar supresión vía Auth Admin en cuenta desechable, archivos, copias/proveedores/retención; identificar responsable, soporte e información de privacidad antes de aceptar personas reales. No inventar datos legales.
4. **Operación:** renovar la clave que caduca, comprobar alertas entregadas, contraste del límite conservador de 75 USD con facturación, restauración/reversión conjunta del proveedor y política de contraseñas filtradas en plan compatible sin contratar planes automáticamente.

Estética, voz y planes de recintos con horarios no bloquean esta reparación: estética queda para el final; voz y esos planes siguen excluidos. No se afirma que se hayan descubierto todos los errores.

## Segunda ampliación: DELETE y entradas inválidas

REST real de las 22 tablas: B no puede borrar una fila sintética de A; comparación posterior confirma que cada fila original permanece idéntica. Fixtures obligatoriamente completos. La primera ejecución de la comprobación confundió tablas con clave compuesta con una fila única; se corrigió el filtro a request_id y se repitió con éxito, sin cambios en permisos.

Fallo nuevo reproducido: el chat recibía JSON null y devolvía HTTP500. Chat/daily/motivation/discover ahora rechazan JSON inválido y valores que no sean objetos con HTTP400 después de validar la identidad y antes de acceder a datos/modelo. Onboarding ya rechazaba esos valores. 25 peticiones HTTP autenticadas verificadas, sin nuevas filas en ai_usage, conversaciones, mensajes ni recibos; seis pruebas Deno pasan. El ciclo cloud y una respuesta del modelo real pasan tras el despliegue.

Revisión independiente Astra de rb27puzf8, turno01a13124-d7e6-75c3-a086-4c83f45d828b: acceso/recarga, borradores, preferencias independientes sin recuerdos retirados y evolución pasan sin regresiones observadas. No probó SMTP en ese turno ni aprobó beta.

## Cierre actualizado de esta ronda

El estado vigente y los límites de cada prueba están en [beta-closure-2026-10-12.md](beta-closure-2026-10-12.md). Auth Admin ya se ha ejecutado en una cuenta nueva desechable con las 22 tablas pobladas; identidad antigua rechazada y B idéntica. Panel privado agregado autorizado y observado, responsable/país/contacto publicados, 32 pruebas Node y 10 Deno pasan. Las afirmaciones históricas anteriores no certifican cierre externo de beta.

Segunda revisión independiente: ayuda urgente local y rechazo terminal de reintentos reparados; 32 pruebas Node pasan. Daily16/motivation16 incluyen regla de seguridad tecnológica; despliegue nuevo de chat bloqueado por errores internos, chat20 sigue anterior. Consultar manifiesto y beta-closure antes de declarar reparaciones activas.

Reparación posterior del onboarding terminal en fc6b766; full32 Node pasa tras corregir el fixture de reloj en b62a14f. Registro nuevo, confirmación/entrada y link consumido por Gmail pasan; no caducidad temporal.

Actualización que sustituye el bloqueo de despliegue indicado anteriormente: chat21 ya activo y ayuda urgente comprobada con cuota429 real, sin mensajes/memorias nuevos. No repetir semántica del modelo mientras no haya cupo, ni atribuir esa prueba al consejo de abuso.
