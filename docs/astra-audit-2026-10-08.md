# Auditoría interactiva SELF-IA — 8 de octubre de 2026

Preview: https://self-ia-mobile-pz0dmor37-self-ia.vercel.app/

Commit: `da5cda86c144296cf5ecc5aeaa71b2daf2517601`. Auditor: chat Astra 6 `01a11b97-fd05-7430-9070-06f74c569fc1`. Cuenta sintética B; producción no modificada.

## Estado para desarrollo

Las cuatro reparaciones principales se verificaron de forma interactiva. La auditoría detectó nuevos pendientes; esta versión no se considera validada para producción.

| Prioridad | Pendiente | Corrección requerida |
|---|---|---|
| P1 | El chat no recibe el último resultado, contexto y fecha de la acción | Separar hechos de seguimiento de memoria retirada: conservar estado/fecha/vínculos y contexto explícitamente declarado, sin volver a introducir aprendizajes ni texto derivado retirados. |
| P2 | Resúmenes activos todavía recomiendan aprendizajes retirados | Marcar o actualizar el resumen derivado; conservar evidencia en el historial y excluirlo del contexto vigente. |
| P2 | Identificadores técnicos en respuestas | Usar nombres comprensibles y evitar identificadores internos en texto visible. |
| P2 | Plan guardado sin descripción/fuente accesibles | Conservar la fuente al guardar y permitir recuperar detalles desde Mi semana; no inventar fuentes de planes antiguos. |
| P3 | Marcas de formato visibles y hora predeterminada pasada | Renderizar formato de forma segura y proponer siempre una fecha/hora futura válida. |

La lectura del código confirma que `continuityContext` filtra por completo agenda y revisiones ligadas a un recuerdo retirado, lo que puede eliminar también datos operativos independientes. La interfaz de agenda no muestra `notes` ni fuente y `schedulePlan` no persiste `source_url`. Esas observaciones apoyan los hallazgos; las correcciones de esta segunda tanda siguen pendientes de implementación y verificación.

## Informe de Astra — 01a11c88-7275-7d51-9bbb-b86c7f703dd4

**La preview reparada mejora claramente: las cuatro reparaciones principales pasan la prueba interactiva. Pero queda un fallo importante: el chat no recibe resultados, contexto y fechas que sí están guardados en agenda e historial.**

Audité la [preview fija reparada](https://self-ia-mobile-pz0dmor37-self-ia.vercel.app/), correspondiente al commit indicado `da5cda86`, con la cuenta sintética B. Usé móvil de 390 × 844 y una comprobación visual de escritorio de 1366 × 900. No modifiqué código, configuración ni producción; cerré las pestañas temporales.

**Reparaciones verificadas**

| Reparación y pasos | Resultado esperado | Observación real |
|---|---|---|
| Abrir repetidamente Faro desde su objetivo, con memoria retirada | Conservar el asunto original | **Pasa.** Empecé con tres asuntos históricos y seguían siendo tres después de dos conversaciones nuevas. La nueva acción quedó vinculada a «Prioridades del proyecto Faro». |
| Aceptar una acción y buscarla sin fecha | Encontrarla desde la confirmación y Compromisos | **Pasa.** Aparece «Ver compromiso y elegir fecha» y la sección «Compromisos sin fecha» en ambas rutas. |
| Reabrir y corregir un resultado | Recuperar sus campos y conservar versiones | **Pasa.** Resultado, contexto y fecha estaban prellenados. «Corregir el último resultado» y «Registrar un nuevo intento» tienen comportamientos distintos. |
| Consultar origen de memoria e historial del objetivo | Mostrar procedencia real y cambios comprensibles | **Pasa.** Se muestran declaración, resultado, contexto, siguiente paso y etiquetas legibles. El objetivo registra pausa, reanudación, cierre y reapertura. |

El saludo también está corregido: muestra «Hola», sin el correo largo.

**Recorridos adicionales completados**

- **Dos objetivos independientes:** Faro y «Huerto Balcón: sembrar albahaca». Cada uno conservó su asunto y sus acciones; no observé mezcla de contextos.
- **Tema nuevo:** mediante «Empezar otro asunto» introduje una merienda ficticia con Leo. Creó sólo el asunto social esperado, sin guardar acciones ni objetivos.
- **Corrección con sustitución de aprendizaje:** en el huerto sustituí «una lista en papel me ayudó» por «una maceta azul junto a la puerta me ayudó». La lista quedó como «Ya no aplica» y el chat utilizó la versión nueva sin que yo repitiera su contenido.
- **Retirada posterior:** «No volver a usar» retiró la maceta azul. La conversación siguiente declaró que no tenía aprendizaje vigente y no la reutilizó.
- **Resultados distintos:** registré parcial, no hecho, prefiero no revisarlo, ya no tiene sentido y movido. El historial conserva **seis registros del huerto**, incluyendo la corrección.
- **Sin aprendizaje automático:** los resultados sin declaración no crearon recuerdos. Al terminar había tres recuerdos retirados y ninguno vigente.
- **Validación y reintento:** mover sin fecha mostró «Elige una fecha futura» y conservó el texto. El reintento dejó la acción para el **12 de octubre, 16:30**.
- **Objetivos:** pausé, retomé, cerré y reabrí Huerto Balcón. Faro permaneció activo. El historial mostró las cuatro transiciones.
- **Mapa y Evolución:** no dedujeron tendencia con esta muestra. Evolución contó **dos acciones revisadas, ambas movidas**, sin multiplicarlas por sus revisiones.
- **Planes:** obtuve dos propuestas con fuentes HTTPS, abrí la fuente municipal de la feria del libro y guardé el plan para el **10 de octubre, 12:00**. Una hora pasada fue rechazada antes de guardar.
- **Persistencia:** tras recargar continuaban el compromiso sin fecha, las fechas, los vínculos, los resultados y los recuerdos retirados.

El conteo final de **cinco asuntos** es coherente: tres históricos de Faro, uno del huerto y uno social. **No son cinco duplicados nuevos.**

**Hallazgos pendientes, con reproducción**

**P1 — La conversación pierde el seguimiento registrado.**

Pasos:
1. Corregir en agenda el contexto del resultado de Faro, sin declarar aprendizaje.
2. Abrir otra conversación desde su objetivo.
3. Preguntar por el contexto vigente.

Esperado: recuperar el resultado corregido como dato del seguimiento, sin convertirlo en aprendizaje personal.

Observado: respondió que no recibía el motivo corregido y pidió que lo escribiera otra vez.

Lo reproduje también con el huerto: después de mover su acción al 12 de octubre a las 16:30, pregunté desde el asunto por último resultado, contexto y fecha. Respondió:

> «No me llegan los datos […] del último resultado registrado de su acción, el contexto que escribiste ni la fecha y hora programadas».

Esos datos seguían visibles después de recargar. **La persistencia funciona; la continuidad conversacional queda incompleta.**

**P2 — Un resumen activo sigue recomendando un recuerdo retirado.**

Pasos:
1. Utilizar en conversación el aprendizaje de la maceta azul.
2. Retirarlo con «No volver a usar».
3. Abrir «Asuntos abiertos».

Esperado: que el resumen no presente ese aprendizaje retirado como recomendación vigente.

Observado: el asunto todavía indicaba que el siguiente paso era reutilizar la maceta azul. **No observé reutilización en el chat**, pero la pantalla activa contradice la retirada. Conviene actualizar o marcar los resúmenes derivados, conservando el historial.

**P2 — El chat muestra identificadores internos.**

En la respuesta sobre el seguimiento ausente del huerto mostró el identificador técnico completo del asunto. Es reproducible con la pregunta anterior. No aporta información útil al usuario y hace más confuso el fallo de continuidad.

**P3 — Formato y valores predeterminados poco pulidos.**

Las respuestas muestran literalmente marcas `**` en móvil y escritorio. Además, al buscar un plan después de las 18:00, el formulario propone hoy a las 18:00: la validación funciona, pero obliga a corregir un valor que la propia aplicación ofrece.

**Prioridades antes de publicar**

1. Hacer llegar al chat el último resultado vigente, su contexto y la fecha programada, respetando las exclusiones de memoria.
2. Resolver la contradicción entre recuerdos retirados y resúmenes activos.
3. Evitar identificadores internos y corregir formato y horas predeterminadas.
4. Repetir estos casos después de los cambios, especialmente con dos objetivos y memorias retiradas.

**El ciclo aporta continuidad útil**, especialmente en aceptación explícita, agenda, versiones y control de recuerdos. Ahora el punto débil está entre el seguimiento registrado y la siguiente conversación: obliga al usuario a repetir información que ya entregó.

No observé bloqueos de Auth o Vercel ni errores en la consola consultada. No probé caídas de servicios, sesiones revocadas, concurrencia, aislamiento entre usuarios, voz ni una auditoría completa de accesibilidad. Esta cuenta sintética **no valida exhaustivamente seguridad, calidad general ni preparación para producción**.

## Informe de Astra — 01a11ca2-7c70-7450-a6f6-f3fff37f2621

He ampliado la auditoría y comunicado el nuevo fallo al detectarlo.

**Nuevo fallo confirmado — P2: los planes guardados pierden acceso a su información práctica.**

- **Pasos:** elegir un plan en «Qué hago hoy» → guardarlo → recargar → abrirlo en «Mi semana» y revisar sus opciones.
- **Esperado:** poder consultar de nuevo descripción y fuente.
- **Observado:** la feria del libro conserva título y fecha, pero no muestra descripción, enlace ni un control para recuperarlos. La revisión sólo permite registrar resultados.
- **Impacto:** obliga a buscar otra vez horarios, ubicación y condiciones. No puedo afirmar que esos datos se hayan borrado internamente; sí que no son recuperables desde esa interfaz.

**Dos comprobaciones adicionales pasaron:**

- Al salir de una conversación mientras llegaba la respuesta y abrir el huerto, la respuesta tardía no apareció en el chat equivocado. El asunto original quedó conservado.
- Al pulsar «Empezar otro asunto» desde Faro, crear el álbum familiar y aceptar su acción, ésta quedó vinculada únicamente al álbum. El formulario mostró **«Objetivo relacionado: Sin vincular»**.

La prioridad principal sigue siendo el **P1 ya reproducido en Faro y huerto: el chat no recibe resultados, contexto y fechas que sí están guardados**. Después atendería los resúmenes que siguen recomendando recuerdos retirados y la recuperación de detalles de planes.

No hubo nuevos errores de consola. Cerré las pestañas temporales y no modifiqué código ni configuración. Esta ampliación no cubre concurrencia entre dispositivos, caídas de servicios, aislamiento entre usuarios, voz ni accesibilidad exhaustiva.

## Límites y siguiente verificación

No se han probado exhaustivamente caídas de servicios, sesiones revocadas, concurrencia entre dispositivos, voz o accesibilidad. La auditoría interactiva no sustituye las pruebas separadas de Auth/RLS ni una evaluación general con varios usuarios. Tras corregir los pendientes, repetir Faro y huerto con resultados sin aprendizaje, corrección y retirada, y comprobar detalles de planes tras recargar. Preservar los duplicados históricos; no borrarlos ni confundirlos con nuevas duplicaciones.

Seguimiento: último cursor entregado `5db7b80c-d174-4382-9bee-cee8cd750d7a:6`. Auditoría finalizada; seguimiento de esta ejecución se pausa para evitar avisos repetidos.

