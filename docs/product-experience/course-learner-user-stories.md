# LUMA — User Stories: del pago al aprendizaje real

**ID:** US-LRN-001 · **Producto:** Practitioner PNL / Seres de Excelencia (modelo reutilizable para cualquier curso)
**Escenario de referencia:** compra aprobada el 13 de octubre de 2026, primer ingreso ese día, avance sobresaliente durante la primera sesión.
**Estado:** Contrato de producto + pruebas de QA con Jeremy, Abigail y Adán; no implica que todos los recorridos estén ya desarrollados.
**Fuente de aceptación:** `docs/qa/course-lifecycle-acceptance.md`.
**Manual derivado:** `docs/user-guide/learner-course-journey-draft.md`.

## Épica

> Como **participante que adquirió un curso en Hotmart**, quiero llegar a LUMA, identificar de inmediato qué compré, saber exactamente dónde empezar, recorrer lecciones y prácticas en un orden comprensible, recibir ayuda cuando tengo preguntas y conservar mi progreso de una sesión a otra, para desarrollar capacidades demostrables sin aprender a manejar una plataforma compleja.

**Resultado verificable:** desde la confirmación de pago al primer aprendizaje registrado y recuperable, sin un segundo proceso de compra, sin confundir demostraciones con avances reales y sin que una persona ajena vea evidencias privadas.

## Personas ficticias para las pruebas

| Persona de QA | Contexto | Objetivo real | Comportamiento que tensiona el CX |
| --- | --- | --- | --- |
| **Jeremy** | Compra aprobada, domina conceptos, 35 min, diagnóstico acertado, confianza 5/5 | Avanzar muy rápido sin saltar la práctica demostrable | Completa 3/3 criterios, explora otro módulo, regresa en otro navegador y pide más dificultad |
| **Abigail** | Compradora principiante, 8 min, diagnóstico erróneo, confianza 2/5 | Entender qué hacer sin agobio | Necesita pistas, tiempo corto, sale y vuelve; no se le debe atribuir dominio |
| **Adán** | Participante inquisitivo, 20 min | Preguntar por una idea del módulo y recibir fuente verificable | Busca tutor dentro del curso, intenta ir de respuesta a la fuente y necesita recuperación cuando el RAG está caído |
| **Julián** | Usuario autenticado sin compra | Entender por qué no puede acceder y cómo resolverlo | Intenta abrir programa y APIs por URL; no debe obtener acceso por tener cuenta |
| **Sofía** | Entrenadora con rol y alcance de tenant | Acompañar a Jeremy y Abigail basándose en evidencias | Consulta progreso del alumno, interviene y no ve datos de otras instituciones |
| **Mariana** | Personaje de demostración existente | Servir como referencia visual, **no** como alumno real del tenant | Los datos de demostración no pueden mezclarse con los de usuarios QA ni presentarse como certificados |

Se usan nombres descriptivos y correos `@example.test` descartables. No son personas ni compradores de Hotmart reales.

## Historias del recorrido

### US-LRN-001.1 — De Hotmart a LUMA

**Como** comprador, **quiero** entrar en LUMA con el mismo correo verificado usado en la compra, **para** que la inscripción se active sin pagos repetidos.

**Dado** un evento `PURCHASE_APPROVED` autenticado y un mapeo producto→programa activo, **cuando** Jeremy entra a LUMA con su correo verificado, **entonces** encuentra exactamente una inscripción activa para Practitioner PNL y no ve programas no comprados como autorizados.

**Controles:** Hottok inválido→401; evento duplicado→sin nueva inscripción; reembolso→revocación; otro correo/tenant→403; transacciones no se registran como logros educativos.

### US-LRN-001.2 — Primer minuto y orientación

**Como** participante nuevo, **quiero** ver el nombre del curso, qué contiene y el siguiente paso inequívoco, **para** empezar en menos de 60 segundos sin preguntar al soporte.

**Aceptación:** "Mi curso" o equivalente muestra programa adquirido, estado de acceso, punto de partida, CTA primario, duración, ayuda y retorno; la página debe distinguir práctica, lección, transmisión en vivo y certificado. En un móvil de 390×844 el CTA es alcanzable, no está tapado por la navegación inferior. No debe mostrarse logro 3/3 sin haber practicado.

### US-LRN-001.3 — Definir punto de partida sin mentir sobre dominio

**Como** participante, **quiero** indicar objetivo, responder un diagnóstico breve y declarar tiempo/confianza, **para** recibir una ruta inicial explicable.

**Aceptación:** opciones seleccionables individualmente, validación del diagnóstico, guardar en servidor asociado a su UID/tenant/programa, nueva sesión recupera esos valores. Autopercepción no equivale a capacidad demostrada.

### US-LRN-001.4 — Encontrar la clase y el material

**Como** participante, **quiero** ver la estructura de módulos/temas, qué está disponible, prerrequisitos y lecciones, **para** saber qué tomar y qué viene después.

**Aceptación:** orden curricular real, activos con estado y licencias correctas, video/texto/descargas autorizadas cuando correspondan, estado de lección (no iniciada/en curso/completada), retomar posición real, y enlaces que conduzcan a contenido utilizable. Una tarjeta estática de módulo no cuenta como reproducción o finalización de curso.

### US-LRN-001.5 — Practicar con retroalimentación

**Como** Jeremy, **quiero** resolver una situación desafiante y recibir evaluación por criterios, **para** comprobar aplicación, no solo consumo de contenido.

**Aceptación:** elección única, pistas ante errores, progreso de pasos, puntuación asignada por rúbrica del servidor, recibo verificable, siguiente práctica relevante; reintentos no inventan nuevo progreso ni un diploma.

### US-LRN-001.6 — Pedir ayuda contextual

**Como** Adán, **quiero** escribir «No entendí P.A.S., ¿me lo explicas con un ejemplo?» y acceder a la fuente, **para** aclarar dudas sin abandonar mi lección.

**Aceptación:** pregunta accesible y contextual, respuesta clara con procedencia de contenido autorizado, enlace a material/fragmento, opción de reformular y elevar al entrenador; si el índice RAG no existe o falla, mostrar indisponibilidad honesta con alternativa humana, nunca simular una fuente.

### US-LRN-001.7 — Seguir mañana o desde otro dispositivo

**Como** Jeremy, **quiero** cerrar mi sesión y regresar mañana conservando contenido, lecciones, prácticas y orientación, **para** no empezar de cero.

**Aceptación:** progreso almacenado en Firestore/servicio de verdad, vinculaciones de identidad estrictas, nueva sesión recupera recibos reales y próximo paso sin depender de localStorage; si algo queda pendiente offline, avisar y sincronizar con recibo visible.

### US-LRN-001.8 — Clases en vivo y comunicación

**Como** alumna matriculada en cohorte, **quiero** encontrar mis próximas sesiones, horario en mi zona, instructor y acceso a clase, **para** asistir a la sesión correcta.

**Aceptación:** oferta/cohorte vinculada a su compra, clase correctamente calendarizada, acceso autorizado a LiveKit (o alternativa autorizada), estados no disponible/pendiente; no mostrar clase de otro alumno ni inventar enlace.

### US-LRN-001.9 — Progreso significativo y certificados

**Como** participante, **quiero** saber qué demostré, qué resta y cuándo cumplo los requisitos del certificado, **para** evaluar mi desarrollo sin métricas de fantasía.

**Aceptación:** rúbricas/actividades vinculadas a curso y alumno, distinción entre reflexión auto-reportada y evaluación, criterios de finalización publicados, certificados solo cuando exista acreditación real y firma/verificación autorizadas.

### US-LRN-001.10 — Intervención del entrenador

**Como** Sofía, **quiero** ver fortalezas, bloqueos y evidencias de mis participantes, **para** acompañar sin inspeccionar información de alumnos de otro programa o tenant.

**Aceptación:** datos asignados por rol y tenant, tutor/coach sin privilegio global por ser entrenador, seguimiento sustentado en rúbrica, permisos comprobados en API y no solo ocultando el menú.

## Camino feliz de Jeremy, día 1

```text
Compra Hotmart ficticia aprobada
  → Correo verificado / enrollment visible en LUMA
  → Mi curso: Practitioner PNL + empezar
  → Objetivo: emociones · diagnóstico acertado · 35 minutos
  → Identifica Módulo y material autorizado
  → Realiza práctica P.A.S. (3 pasos / 3 criterios)
  → Recibe feedback honesto y próxima acción
  → Pregunta a LUMA por una segunda situación
  → Revisa su agenda y lo que aún necesita demostrar
  → Sale y regresa con sesión nueva
  → Recupera práctica y orientación desde el servidor
  → Entrenadora del mismo tenant revisa evidencia
```

## Definition of Done de la épica

1. El camino feliz puede ejecutarse con **browser real + backend emulado**, con resultado repetible y sin datos de producción.
2. Los caminos negativos de compra, identidad, tenant, refund, pregunta sin RAG y conectividad están probados.
3. Enlaces/estados de lecciones, progreso multi-dispositivo y aula en vivo tienen verificación específica o quedan abiertamente **BLOCKED / NOT_IMPLEMENTED**.
4. QA adjunta capturas desktop y móvil sin PII, pruebas funcionales, errores de consola, performance/axe y los defectos enumerados.
5. El manual explica solo capacidades confirmadas; las futuras se marcan explícitamente como planificadas.

**No se debe considerar «curso completado» únicamente por haber terminado la simulación PAS o escrito una reflexión.**
