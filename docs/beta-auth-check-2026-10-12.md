# Acceso real de pruebas — 12 octubre 2026

Entorno: Supabase `tleqdegnzeukonbbrrzk`, preview `0856aec`/`oid9f4y0d`, chat v15. Buzón expresamente autorizado para esta prueba, omitido del repositorio público. No se cambiaron contraseñas personales, Gmail ni producción. B se conserva.

Astra, turno `01a12fd1-b371-7dc2-bcdc-d57275e5c983`: registro creado, mensaje de confirmación recibido, cuenta confirmada y login correcto. Confirmación retornaba a `http://localhost:3000`, lo que impedía el retorno normal a la aplicación. F07 no está cerrado.

Corrección verificada en el panel de **SELF-IA Pruebas**, no en Supabase de producción:

- Site URL: `https://self-ia-mobile-git-selfia-continuity-preview-self-ia.vercel.app`.
- Redirect URLs exactas: esa dirección y `https://self-ia-mobile-oid9f4y0d-self-ia.vercel.app`.
- Sin comodines ni destinos de terceros. El panel mostró guardado correcto y ambas URLs.
- Un correo anterior mantiene su dirección anterior; hace falta un mensaje nuevo para verificar la reparación completa.

La solicitud de recuperación quedó bloqueada por `email rate limit exceeded`. El panel SMTP de este proyecto mostró `Enable custom SMTP` desactivado: no hay servicio propio configurado. No se redujo el límite, se desactivó confirmación ni se compró/configuró otro servicio de correo. La contraseña no se ha cambiado. No repetir envíos continuamente: reintentar cuando el servicio permita enviar o preparar un servicio SMTP de la beta con configuración autorizada y probada. Se ha solicitado únicamente el dominio remitente disponible; no claves ni contraseñas.

Pendientes: nuevo correo de recuperación, destino correcto, pantalla de nueva contraseña, paso humano de cambio, login con contraseña nueva, enlace reutilizado/vencido y aislamiento de sesiones. El registro/inicio de sesión observado no equivale a aprobar toda recuperación.

La explicación anterior de que todo registro requería que el humano introdujera credenciales era demasiado amplia, según corrección de Astra. Las reglas efectivas del navegador sí reservan al humano cambiar una contraseña: entrada, confirmación y envío. No se publican contraseña, token, OTP ni enlaces de un solo uso en este documento.

## Actualización: SMTP guardado, autenticación rechazada

El usuario autorizó explícitamente conectar el buzón empresarial elegido mediante SMTP únicamente en pruebas y almacenar su credencial en Supabase. La introdujo directamente en el panel y confirmó «listo» para guardar/probar. No se leyó ni exportó la credencial, no se cambió la contraseña del buzón ni la de SELF-IA y no se contrataron servicios ni modificó DNS.

Se guardó custom SMTP de IONOS (`smtp.ionos.es`, puerto 465, intervalo por usuario 60 segundos). Tras recargar, el panel mostró servicio activo y credencial almacenada oculta. El remitente y usuario se mantienen fuera de este documento público.

Astra, turno `01a12feb-c103-74b1-b012-47122a12ea71`, hizo un único intento de recuperación autorizado desde la preview estable: `Error sending recovery email`, sin correo nuevo. Consulta acotada de `auth_logs` en pruebas confirmó respuesta del proveedor **535 Authentication credentials invalid**. No es el límite anterior de correo ni evidencia de un fallo TLS. Corregir autenticación antes de otro intento; no reintentar en bucle ni dar este paso por aprobado.

Estado actual: configuración persistida, envío bloqueado por autenticación SMTP, recuperación completa pendiente. El formulario queda al usuario para corregir la credencial del buzón en el campo privado. Solo se repetirán la entrega y el retorno después de corregirla. Ninguna producción se modificó.

Segundo intento después de que el usuario confirmó guardar la credencial corregida: panel recargado con custom SMTP activo y Save deshabilitado. Astra, turno `01a12ff5-d70b-7290-b431-f0e62094ddec`, volvió a observar `Error sending recovery email`, sin mensaje nuevo. Consulta de `auth_logs` limitada al intervalo iniciado el 12 octubre a las 11:53:23 UTC confirmó de nuevo **535 Authentication credentials invalid**. La causa no se da por resuelta. No se seguirán enviando solicitudes iguales: pendiente comprobar si el acceso al buzón funciona en Webmail de IONOS o si corresponde a otro tipo de cuenta. No se cambia su contraseña ni se solicitan secretos por chat.
