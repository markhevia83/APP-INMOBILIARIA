# Reparación de hallazgos de Astra — 8 de octubre de 2026

Rama de desarrollo: `selfia-audit-p0-onboarding`. Preview aislada: `selfia-continuity-preview`. Supabase: `tleqdegnzeukonbbrrzk`. Sin cambios en main, producción, ni eliminación de datos reales.

| Hallazgo | Reparación | Evidencia |
|---|---|---|
| P1: chat pierde seguimiento tras retirar/corregir memoria | Separar hechos operativos de declaraciones y texto derivado. Recuperar explícitamente acciones y resultados del asunto seleccionado fuera de la página general. Último resultado por acción, zona horaria local y contexto seleccionado completo. | Prueba con modelo real: motivo «tienda cerrada por inventario», 12 de octubre 16:30, sin aprendizaje retirado; evento situado fuera de 30 recientes. |
| P2: resumen recomienda aprendizaje retirado | Invalidar resúmenes dependientes de origen/uso de memoria, preservar versión en historial con RLS, mostrar aviso y acceso explícito a versiones anteriores. Una nueva conversación puede actualizar el resumen. | Prueba PostgreSQL: invalida sin borrar, conserva resumen anterior, otra cuenta no lee ni inserta vínculos ajenos. Migración marca también dependencias existentes. |
| P2: UUID visible | Instrucción al modelo y sustitución en respuesta persistida; protección adicional al mostrar conversaciones anteriores. | Respuesta real sin UUID y prueba de renderizado. |
| P2: plan pierde información práctica | Persistir descripción, motivo y fuente HTTPS. Mostrar en agenda y revisión después de recargar. Planes antiguos conservan descripción disponible, sin inventar fuentes. | Recorrido móvil con recarga y consulta del enlace; prueba de persistencia remota. |
| P3: marcas de formato/hora pasada | Renderizar párrafos, énfasis y listas mediante React escapado, sin HTML ejecutable. Proponer una hora futura al elegir plan/abrir agenda/agendar compromiso. | Prueba de formato/HTML/UUID y cambio de día a medianoche. Validación de fecha futura sigue vigente. |
| Adicional: tendencia considera resultado antiguo de acción movida | Seleccionar primero el resultado más reciente y después los estados que aportan tendencia. | Prueba que una corrección «movido» no conserva una finalización antigua. |

Verificaciones completadas antes de publicar preview:

- Once pruebas de lógica, PostgreSQL/RLS, contexto seleccionado, fuentes, presentación y ventanas de disponibilidad.
- Recorrido móvil 390 × 844 completo con modelo simulado y SQL/RLS real; sin solicitudes externas.
- Construcción Vite satisfactoria.
- Pruebas desplegadas de Auth: seis funciones rechazan acceso no autenticado; aislamiento entre dos cuentas, repetición de solicitudes, historial y conflictos de versiones.
- Modelo real: resultado corregido sin aprendizaje, razón, fecha local, continuidad del mismo asunto, exclusión de recuerdo retirado y fuente de plan persistida.
- Advisor de seguridad: sólo aviso preexistente de protección contra contraseñas filtradas desactivada.

Pendiente al registrar este documento: verificación independiente de Astra sobre la nueva preview fija. No equivale a auditoría exhaustiva de voz, accesibilidad, concurrencia multidispositivo, caídas de servicios ni calidad con usuarios reales. La clave restringida del entorno de pruebas caduca el 13 de octubre; renovar si se siguen haciendo pruebas después de esa fecha. Mantener producción sin publicar hasta cerrar la verificación.

## Ampliación tras auditoría de d183ec5

Astra confirmó la recuperación factual de Faro y Huerto, persistencia de planes, horas futuras, formato legible y ausencia de duplicados nuevos. Detectó tres pendientes adicionales:

- P1: una corrección factual heredaba el siguiente paso de una revisión cuyo aprendizaje estaba retirado. Se reproduce con «pinza violeta» reformulada como «broche morado». Reparación: excluir pasos heredados siguiendo la cadena de correcciones, cargar ancestros fuera de la página reciente y no prellenar estos pasos en el formulario. Nueva declaración explícita independiente sigue siendo posible; el historial original se conserva. Verificado con modelo real incluso forzando el valor heredado por RPC.
- P2: historial de resumen invisible. El panel estaba dentro de otra sección. Ahora se muestra en Asuntos abiertos, desplaza la vista hasta él y explica si no hay versiones. Verificado con recorrido móvil.
- P2: plan propuesto después del cierre. La búsqueda sólo tenía fecha. Ahora usa hora real del servidor y zona del usuario, pide horarios verificables y filtra ventanas cerradas, eventos empezados o tiempo insuficiente para preparación/visita. Las actividades flexibles deben declarar que no dependen de horarios. No se devuelve texto bruto de propuestas descartadas. El formulario comprueba la ventana verificada al guardar. La fiabilidad de horarios sigue dependiendo de las fuentes encontradas; no se garantiza disponibilidad futura.
- P3: «no declarado» confundía una retirada con ausencia histórica. El contexto indica la exclusión y las instrucciones distinguen un paso vigente de uno retirado sin reconstruir su contenido.

Las pruebas de retirada cubren también correcciones heredadas y reformulaciones diferentes; se conservan el resultado factual y la fecha. No se altera ni borra ningún plan antiguo guardado: las comprobaciones nuevas se aplican a propuestas nuevas.

## Cierre independiente — 9 de octubre

Astra terminó el informe sobre la preview `678acf4`, cerrando la evidencia interactiva obtenida el día 8. La ejecución anterior había quedado interrumpida después de las comprobaciones; el cierre recupera esa evidencia, no presenta los planes del 8 como disponibles el 9.

- P1 de paso retirado heredado: pasa. Formulario vacío, corrección factual conserva contexto/fecha/hora, chat no recupera el recordatorio retirado.
- P2 de historial: pasa. Versiones antiguas visibles sin reactivar la recomendación.
- P2 de horarios: caso probado pasa. Fuente confirma sesión de las 22:00, sugerencia correcta, rechazo de las 23:00. No se ofrece el Prado cerrado.
- P3 de redacción: pasa en la respuesta observada, distingue información vigente de historia.
- Persistencia: cine y alternativa flexible guardados; tras recargar mantienen descripción, motivo, horario y fuente. Evolución conserva tres acciones revisadas, sin multiplicarlas por sus correcciones.
- No encontró nuevos fallos bloqueantes en este recorrido. Cuenta sintética B exclusivamente; pestañas temporales cerradas.

Observación menor final: el historial del huerto mostraba dos entradas iguales con fecha idéntica. La consulta de evidencia confirmó una sola versión invalidada por dos recuerdos distintos, no una doble acción. Se corrigió la presentación agrupando esa versión exacta y mostrando el número de recuerdos relacionados. Los registros originales y sus causas permanecen intactos; versiones con otra fecha u origen siguen separadas. Prueba adicional pasa; total actual: doce pruebas y construcción satisfactoria. Esta última agrupación se verificó automáticamente y no forma parte de la comprobación independiente de Astra sobre `678acf4`.

Auditoría cerrada para los casos enumerados. Antes de publicar: evaluación más amplia con usuarios y cobertura de voz, accesibilidad, concurrencia y fallos de servicios; revisar el aviso conocido de contraseñas filtradas y renovar la clave temporal de pruebas si se usa después del 13 de octubre. Ningún cambio de producción se autorizó ni ejecutó en este cierre. Cursor final `4efc36ef-fbdf-4b18-8d6d-e7ee85dbf658:2`.
