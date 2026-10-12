# Revisión independiente de Astra: 12 octubre 2026

Fuente: respuesta final del chat `01a11b97-fd05-7430-9070-06f74c569fc1`, turno `01a12bf6-9a60-7b91-9ff7-0f0cbef1485a`. Candidatos 6559f57 y bbba1c1; backend chat v14; cuenta sintética B. No aprobación de beta/lanzamiento.

F02 seguía fallando: abrir Faro desde «Hablar con SELF-IA», escribir un borrador sin enviarlo, volver a objetivos y reabrir Faro sustituía el borrador por el texto sugerido. No necesita recarga ni respuesta pendiente. Causa: el botón sobrescribía la entrada después de recuperar el contexto.

La reparación posterior usa el texto sugerido solo al crear un contexto. Recupera el borrador existente sin sustituirlo, también cuando el usuario lo dejó vacío; conserva identidad de objetivo/acción cuando se establece su vínculo a un asunto. Regresión de navegador: edición→volver→reabrir→recarga, junto al ciclo completo anterior.

**F02 PASS independiente**: turno `01a12fb7-12bb-7810-a9c9-5957a11d3b89`, preview `0856aec` (`oid9f4y0d`), chat v14 y modelo real. Astra comprobó borrador Faro, vacío intencional, escritura durante respuesta, pausa/reactivación, borradores de asunto/acción y recarga. Sin regresiones observadas en estos casos. Esta reproducción concreta queda cerrada; no implica aprobación de beta.

Siguiente revisión: registro/recuperación con buzón real expresamente autorizado por el usuario; correo no incluido en este documento público. El registro de pruebas se ha creado y muestra confirmación pendiente. Se conserva B y el formulario. La explicación inicial de Astra sobre una prohibición de introducir credenciales nuevas era incorrecta: la reserva al humano corresponde al cambio de contraseña. Registro/recuperación no se marcan PASS hasta completar el flujo.

Resultados independientes comprobados: F01 hecho→omitir deja agenda/compromiso/chat coherentes; F03 rechaza otra fecha y muestra explicación legible; F04 doble pulsación manual y programación exacta producen una entrada (cobertura parcial); F07 entrada/salida local mantienen otra sesión; F08 voz deshabilitada; F09 pasa con modelo real, segunda declaración independiente, corrección y retirada sin recuperar aprendizaje/paráfrasis. Evolución conserva tres acciones revisadas y seis asuntos sin multiplicarlos por correcciones. Exportación descargada con historiales; muestra sin propietarios ajenos explícitos ni credenciales.

Límites: F05/F06 sin inyección independiente de errores de servicio; F10 no ejecutado porque B ya estaba incorporada y no se reiniciaron sus datos; F11 dos búsquedas sin propuestas verificables, guardado nuevo pendiente; F12 continúa pendiente. REST/JWT bloqueado antes de Supabase en el entorno de comandos. Dos vistas no prueban dos dispositivos o cortes de red. Correo real, supresión efectiva, seguridad de uso, presupuesto, alertas y restauración siguen pendientes. Toda modificación de Astra fue sobre datos sintéticos; producción y configuración intactas.
