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

- Nueve pruebas de lógica, PostgreSQL/RLS, contexto seleccionado, fuentes y presentación.
- Recorrido móvil 390 × 844 completo con modelo simulado y SQL/RLS real; sin solicitudes externas.
- Construcción Vite satisfactoria.
- Pruebas desplegadas de Auth: seis funciones rechazan acceso no autenticado; aislamiento entre dos cuentas, repetición de solicitudes, historial y conflictos de versiones.
- Modelo real: resultado corregido sin aprendizaje, razón, fecha local, continuidad del mismo asunto, exclusión de recuerdo retirado y fuente de plan persistida.
- Advisor de seguridad: sólo aviso preexistente de protección contra contraseñas filtradas desactivada.

Pendiente al registrar este documento: verificación independiente de Astra sobre la nueva preview fija. No equivale a auditoría exhaustiva de voz, accesibilidad, concurrencia multidispositivo, caídas de servicios ni calidad con usuarios reales. La clave restringida del entorno de pruebas caduca el 13 de octubre; renovar si se siguen haciendo pruebas después de esa fecha. Mantener producción sin publicar hasta cerrar la verificación.
