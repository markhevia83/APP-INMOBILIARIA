# Acceso real de pruebas — 12 octubre 2026

Entorno: Supabase `tleqdegnzeukonbbrrzk`, preview `0856aec`/`oid9f4y0d`, chat v15. Buzón expresamente autorizado para esta prueba, omitido del repositorio público. No se cambiaron contraseñas personales, Gmail ni producción. B se conserva.

Astra, turno `01a12fd1-b371-7dc2-bcdc-d57275e5c983`: registro creado, mensaje de confirmación recibido, cuenta confirmada y login correcto. Confirmación retornaba a `http://localhost:3000`, lo que impedía el retorno normal a la aplicación. F07 no está cerrado.

Corrección verificada en el panel de **SELF-IA Pruebas**, no en Supabase de producción:

- Site URL: `https://self-ia-mobile-git-selfia-continuity-preview-self-ia.vercel.app`.
- Redirect URLs exactas: esa dirección y `https://self-ia-mobile-oid9f4y0d-self-ia.vercel.app`.
- Sin comodines ni destinos de terceros. El panel mostró guardado correcto y ambas URLs.
- Un correo anterior mantiene su dirección anterior; hace falta un mensaje nuevo para verificar la reparación completa.

La solicitud de recuperación quedó bloqueada por `email rate limit exceeded`. No se redujo el límite, se desactivó confirmación ni se compró/configuró otro servicio de correo. La contraseña no se ha cambiado. No repetir envíos continuamente: reintentar cuando el servicio permita enviar o preparar un servicio SMTP de la beta con configuración autorizada y probada.

Pendientes: nuevo correo de recuperación, destino correcto, pantalla de nueva contraseña, paso humano de cambio, login con contraseña nueva, enlace reutilizado/vencido y aislamiento de sesiones. El registro/inicio de sesión observado no equivale a aprobar toda recuperación.

La explicación anterior de que todo registro requería que el humano introdujera credenciales era demasiado amplia, según corrección de Astra. Las reglas efectivas del navegador sí reservan al humano cambiar una contraseña: entrada, confirmación y envío. No se publican contraseña, token, OTP ni enlaces de un solo uso en este documento.
