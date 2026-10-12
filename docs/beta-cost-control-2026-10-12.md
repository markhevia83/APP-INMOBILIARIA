# Control de gasto de la beta

Autorización humana: 75 US$/mes de IA, diez personas iniciales. No incluye contratar planes de Supabase/Vercel. Aplicación exclusivamente en Supabase de pruebas `tleqdegnzeukonbbrrzk` y rama segura.

## Alcance y límites

Los cuatro endpoints de IA reservan dinero antes de llamar a OpenAI. Límite conjunto: 75.000.000 microdólares por mes natural UTC. Se mantiene también el límite diario de capacidad anterior; puede detener el uso antes del techo monetario y deberá ajustarse con pruebas de carga.

El precio conservador usa 10 US$/millón de entrada y 30 US$/millón de salida, sin descuento de caché, correspondientes a las tarifas superiores de contexto largo/escritura de caché publicadas. Se fuerza servicio Standard (`default`); solo se admiten `gpt-5.6`/`gpt-5.6-sol`, sin herramientas salvo búsqueda web, una llamada como máximo. Las búsquedas reservan el contexto completo porque no conocemos el tamaño de la recuperación antes de la llamada. Puede bloquearse una búsqueda aunque quede dinero para un chat.

Si hay datos de uso válidos, se liquida la reserva con el cómputo conservador. Si falla la red, falta uso, cambia el modelo/tier o falla la liquidación, el importe completo permanece consumido o reservado. Una petición antigua no puede actualizar los metadatos del intento nuevo. La liquidación se ejecuta una sola vez. Si el coste informado supera su reserva, se registra y bloquean futuras llamadas: una estimación no garantiza retroactivamente la factura del proveedor.

Los saldos y reservas no guardan identificadores de usuarios ni contenido. Borrar datos personales no devuelve dinero al saldo general. Las cuentas no pueden leer ni alterar estos registros o invocar sus funciones. Avisos internos: 80%, bloqueo, consumo incierto. **No equivale a alertas entregadas al responsable.**

Es un control de esta aplicación, no un límite de facturación de toda la cuenta OpenAI. Otros proyectos/llamadas con la misma clave, cambios de tarifa, impuestos, infraestructura y posibles partidas del proveedor no observadas quedan fuera. Hay revisión obligatoria de precios antes del 11 noviembre 2026: hasta revisarla el servidor bloquea nuevos envíos. Pendiente contrastar facturación real y configurar alertas externas; no se afirma techo bancario garantizado.

## Estimación de referencia, no factura

26 solicitudes de pruebas, metadatos agregados sin contenido. Tarifa Standard de referencia: entrada 4 US$/millón, salida 20 US$/millón; búsqueda web 0,01 US$/llamada más sus tokens. Chat medio ~0,031 US$, saludo ~0,008 US$, búsqueda ~0,074 US$. Diez personas, cinco chats diarios, un saludo diario y ocho búsquedas por persona/mes: ~54 US$/mes. Muestra pequeña; crecerá con contexto y frecuencia.

Fuentes consultadas 12 octubre 2026: https://developers.openai.com/api/docs/pricing y https://developers.openai.com/api/docs/models/gpt-5.6-sol. Supabase https://supabase.com/pricing y Vercel https://vercel.com/docs/plans/pro-plan se presupuestan por separado. No se ha contratado ningún plan.

## Evidencia y pendientes

Pruebas SQL locales: reserva/denegación antes de capacidad, liquidación idempotente, coste incierto, vencimiento sin reembolso, permisos de usuario, exceso imprevisto y separación del mes anterior. Pruebas del servidor con proveedor simulado: denegación sin llamada, tier obligatorio, rechazo de modelo/herramienta desconocidos, revisión de precios y timeout conservador. 26 Node y 5 Deno PASS; compilación y recorrido React móvil/escritorio PASS.

Guardia activa exclusivamente en test: chat v15; daily/motivation/discover v10. Migración remota `20261012111144_beta_money_budget`. SQL alojado probado con datos sintéticos y ROLLBACK: reserva/denegación antes de capacidad, liquidación idempotente y permisos efectivos de `service_role`. Los dos avisos informativos RLS sin políticas corresponden a estas tablas de presupuesto, intencionadamente inaccesibles al cliente; no se añaden políticas permisivas para ocultar el aviso.

Preview READY `33c0071`, `https://self-ia-mobile-glzduispn-self-ia.vercel.app/`, deployment `dpl_2t5YSYEZqMCfpmjgDzPU25njhSeX`, target preview/null. Bundle descargado: configuración de pruebas y texto de límite monetario presentes. El literal de Supabase de producción sigue apareciendo únicamente como comprobación de protección en el código, no como fallback de configuración.

Astra, turno `01a12fdb-7ae1-7460-af58-78498fe79478`, observó respuesta correcta a una única petición sintética. Metadatos SQL corroboran chat completado, 1697 tokens de entrada y 124 de salida. Esta observación prueba respuesta real con guardia activa, no agotamiento real ni concurrencia HTTP. No se agotó deliberadamente el presupuesto ni se redujeron protecciones. Factura y alertas externas siguen pendientes.
