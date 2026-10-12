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

## Contraste con el otro chat

El turno de Astra01a1311b-04e6-7df3-8236-5148c03f26d9 creó y verificó una cuenta técnica sin buzón para que el usuario pueda seguir probando. Esto resuelve el acceso de esa cuenta, no SMTP ni recuperación. Credenciales omitidas del repositorio. Consulta limitada de logs entre16:40 y17:30UTC devuelve tres registros con535; no equivale necesariamente a tres intentos independientes. Host/puerto actuales coinciden con la documentación IONOS: smtp.ionos.es:465.

El usuario indicó haber cambiado la contraseña del buzón y escrito la nueva en Supabase. Se solicitó que complete Guardar; la herramienta de navegador reserva al humano entrada, confirmación y envío al sustituir una credencial. No se imprime ni guarda la contraseña compartida. Entrega/recuperación aún sin verificar con esa última corrección.

## Última comprobación tras guardado humano

El usuario confirmó Guardar después de cambiar la credencial. Un único resetPasswordForEmail al buzón de pruebas autorizado, con redirect al alias estable exacto, devolvió500 unexpected_failure / Error sending recovery email. El intento se realizó con cliente efímero sin sesión; no cerró B ni la sesión del usuario. Consulta acotada de auth_logs desde17:38UTC confirmó un registro SMTP_AUTH_535. No se repite en bucle.

El Webmail oficial de IONOS, con autorización humana específica para comprobar acceso, rechazó la dirección elegida como cuenta no encontrada antes de pedir contraseña. La contraseña no se transmitió a IONOS. DNS público confirma MX00/MX01 de IONOS; el dominio no prueba que esa dirección concreta sea un buzón válido ni qué producto usa. El usuario indica haber cambiado la contraseña en el panel IONOS.

Host465 y formulario SMTP activo/persistido se verificaron; el panel oculta usuario/remitente. Reintroducir los valores de identidad autorizados no habilitó Guardar, así que no se dio por hecha una corrección de identidad ni se modificó contraseña. Las comparaciones DOM con valores ocultos no son prueba de errata. El panel administrativo IONOS no tiene sesión abierta en este navegador: pendiente acceso humano para comprobar dirección exacta, tipo de buzón/alias y lugar donde se cambió la contraseña. No se adivinan credenciales ni se modifica correo empresarial, DNS o producción.

## Causa confirmada en el panel administrativo

El usuario inició sesión en IONOS. Se abrió Correo y se filtró específicamente por el dominio elegido: el panel muestra **No existe ninguna dirección de correo electrónico**. No hay un buzón configurado bajo ese dominio en el portafolio mostrado; la contraseña aportada no permite autenticar un remitente inexistente. No se modificó ni creó ninguna cuenta, contrato, credencial o registro DNS. El panel contiene otros productos de correo disponibles, pero no se usan como remitentes sin elegir la dirección exacta y autorizar la conexión.

Pendiente elección del usuario: usar un buzón existente con su dirección exacta, o preparar un buzón de SELF-IA únicamente si está incluido sin coste, revisando antes disponibilidad y efectos de configuración. No se compran planes automáticamente ni se atribuye a código de SELF-IA la ausencia de ese buzón. Entrega/recuperación seguirán pendientes hasta verificar el remitente nuevo.

## Remitente alternativo elegido: Gmail

El usuario eligió su Gmail existente; la dirección personal se omite del repositorio. Borrador preparado en Supabase de pruebas: host smtp.gmail.com, puerto465, nombreSELF-IA e identidad del remitente elegido; no se guardó ni se tocó la contraseña almacenada. No enviar mientras permanezca la credencial del proveedor anterior.

Google requiere verificación en dos pasos para una contraseña de aplicación: [documentación oficial](https://support.google.com/accounts/answer/185833?hl=es). Generación y entrada de la nueva credencial reservadas al humano; no se leerá ni copiará su valor. Conexión/almacenamiento en Supabase pendientes de autorización específica para el nuevo Gmail. El panel de Supabase advierte que un proveedor de correo personal puede afectar a la entrega transaccional; no se certifica adecuación para lanzamiento por haber preparado estos campos.

Antes de declarar este gate cerrado: credential de aplicación guardada directamente por el usuario, persistencia de configuración verificada sin valores secretos, un envío autorizado aceptado, recepción comprobada y recorrido completo de recuperación. Ninguna cuenta Google/IONOS, contrato, DNS ni producción modificados en este paso.
