# LUMA — Auditoría CX del curso: veredicto independiente

**Tipo:** navegador real, identidades emuladas, backend HTTP real, datos enteramente desechables.
**Base:** `origin/main 7ef32ba9ff3c56896da536a86ca14286b99ddfb3` · `demo-luma-course-journey-e2e`.
**Fecha de referencia (Guatemala):** 2026-10-12.
**Evidencia cruda y reproducible:** `evidence/qa-course-journey-20261012/run-summary.json` y `scripts/qa-course-journey-runner.mjs`.
**Resultado bruto de la última ejecución:** **37 checks, 28 PASS, 9 FAIL**. La suite completó el recorrido sin un bloqueo general; los dos checks de Sofía fallaron por no disponer de token de autenticación estable tras cambiar de ruta en el arnés de navegador (pendientes de repetir con un fixture independiente).
**Gate para afirmar «curso completo enterprise»: NO-GO.**
**No es una auditoría sobre producción ni una compra real.**

## Qué ya funciona

| Comportamiento | Evidencia | Veredicto |
| --- | --- | --- |
| Compra simulada Hotmart V2 para tres personas | POST webhook autenticado → inscripciones por tenant y producto | PASS |
| Identidad de Valeria y matrícula | login emulador por navegador + GET `/api/commerce/access` | PASS |
| Cohorte asociada a la compra | sesión de QA visible en agenda de la alumna | PASS |
| Onboarding en cuatro etapas | objetivo, diagnóstico, 35 minutos guardados en Firestore | PASS |
| Catálogo y acceso a práctica | siete módulos, ficha de P.A.S., actividad puntuable | PASS |
| Alumna avanzada: 3/3 | 3 pasos en navegador, feedback y `SIMULATION_COMPLETED` en Firestore versión 2 | PASS |
| Ruta tras la práctica en mismo navegador | `ProgressStory` muestra evidencia local | PASS |
| Tutor sin corpus de pago | HTTP 503 y mensaje honesto, sin fuente inventada | PASS como error transparente |
| Certificados | estado vacío, sin emisión ficticia | PASS |
| Alumno principiante | onboarding de ocho minutos y pista ante error | PASS |
| Reflexión | correctamente etiquetada como «auto-reportada» | PASS |
| Alumno sin compra | la API de aprendizaje protege recursos, 403 | PASS |
| Coach de otro tenant | API rechaza lectura individual: 403 | PASS |
| Cambio Valeria→Andrés en misma ventana | no se observó exhibición de la nota ajena en pantalla en este escenario | PASS limitado al escenario probado |
| Móvil 390×844 | CTA principal sin solapamiento detectado en la sesión medida | PASS |
| Separación de Mariana | ningún registro de matrícula QA atribuido a Mariana | PASS |

## Defectos confirmados de producto — reparar por orden

### CX-COURSE-P0-01 · Evidencia persistente no reconstruida en pantalla tras volver

**Historia:** US-LRN-001.7.
**Reproducción:** Valeria completa PAS con 3/3 y evento confirmado en Firestore; se inicia sesión en un contexto nuevo: `GET /api/learning/plan` devuelve versión 2, pero `ProgressStory` vuelve a mostrar su estado inicial porque se alimenta del `luma-latest-learning-event` de localStorage.
**Efecto:** el alumno cree haber perdido un logro aunque backend lo conserva.
**Aceptación:** el servidor proporciona una proyección/eventos autorizados por UID/tenant/programa y el panel muestra exactamente esa rúbrica; nunca «dominio» de datos de demostración.

### CX-COURSE-P0-02 · Frontera visual entre vista pública y contenido de pago

**Historia:** US-LRN-001.1/1.4.
**Reproducción:** Julián inicia sesión sin matrícula; `/api/learning/plan` responde 403 correctamente, pero el catálogo ofrece enlaces «Abrir práctica» y la ficha/simulación de PAS puede visitarse sin entitlement.
**Efecto:** experiencia confusa y riesgo de exposición de contenido que se considere premium.
**Importante:** no se observó un escape de las APIs protegidas; estas pruebas **no** prueban filtración de datos privados. Definir explícitamente un modo de vista previa con contenido público permitido y un bloqueo de las unidades exclusivas, idealmente en servidor y no solo en navegación.

### CX-COURSE-P1-03 · Falta confirmación del producto comprado

**Historia:** US-LRN-001.2.
**Reproducción:** tras verificar inscripción de Valeria, `/learn` muestra «Aprender con LUMA», sin una tarjeta inequívoca de «Mi curso: Practitioner PNL / inscrita / acceso activo / empezar».
**Aceptación:** contexto del programa más CTA claro, especialmente en el primer ingreso y en cuentas con varios cursos.

### CX-COURSE-P1-04 · Módulos editoriales no son aulas/lecciones completas

**Historia:** US-LRN-001.4.
**Reproducción:** `/learn/experiences` muestra siete portadas y varias prácticas; la ficha `/learn/experience/pas-detectar-y-reformular` tiene teoría, pasos, reflexión y enlace a simulación, pero no reproduce una lección en video ni registra posición vista.
**Efecto:** no se puede completar «todo Practitioner» como curso estructurado solo con esa interfaz.
**Aceptación:** módulo→unidad→material publicado→progreso persistente→siguiente lección; las unidades todavía no disponibles deben indicarlo honestamente.

### CX-COURSE-P1-05 · Tutor no tiene salida humana cuando falla el índice del curso

**Historia:** US-LRN-001.6.
**Reproducción:** Natalia/Valeria preguntan por P.A.S. / niveles lógicos. Con `LUMA_SCOPED_RAG_URL` ausente, responde honestamente «El contenido de este programa no está disponible», sin enlace de contacto, enviar pregunta al entrenador ni reintento accionable en el panel.
**Aceptación:** recuperación visible y segura: reintentar, consultar material autorizado y escalar al tutor humano cuando corresponda. Con un RAG real habrá que verificar citas y exactitud, cosa no probada aquí.

### CX-COURSE-P1-06 · Reflexión auto-reportada no retiene el estado entre navegadores

**Historia:** US-LRN-001.7.
**Reproducción:** Natalia envía una reflexión de más de 25 caracteres, recibe recibo `PRACTICE_REFLECTION_RECORDED` y queda en localStorage. Con un nuevo contexto no reaparece.
**Aceptación:** registro no evaluado en servidor, vinculado a persona/experiencia/curso, respetando que **no demuestra dominio**, y acceso con permisos del tenant.

### CX-COURSE-P1-07 · Catálogo no indica qué está disponible para el invitado

**Historia:** US-LRN-001.2/1.4.
**Reproducción:** la exploración de módulos no diferencia de forma suficiente «vista previa», «incluido en tu matrícula», «próximamente» y «requiere compra».
**Aceptación:** señales de permiso y publicación sustentadas en backend, cero acciones falsas o sin destino.

## Dos fallos de QA por aislar — no atribuidos al producto

**QA-BLOCKED-01/02 — navegador del entrenador Sofía.** En la ejecución con muchas ventanas de Playwright, el bridge temporal del Auth Emulator pudo autenticarse y abrir `/studio`, pero su token no permaneció disponible para las aserciones de consultas al entrenador. Las dos comprobaciones figuran como `FAIL` en el reporte bruto y **no deben leerse como prueba de un bug de autorización en producción**. Un E2E backend anterior sobre el mismo modelo verificó lectura por coach, y el entrenador de otro tenant recibió 403 aquí. Repetir Sofía en una suite/fixture dedicada, con identidad del emulador persistente y captura del estado antes/después de cambiar de ruta.

No se atribuye resultado de un turno de progreso a Mariana ni a cuentas reales.

## Observaciones pedagógicas y UX para las próximas iteraciones

- **Valeria «va súper bien»** significa que resolvió PAS con 3/3 en esta actividad. No prueba que haya completado el programa ni su transferencia a situaciones nuevas.
- **Andrés recibe pista**, pero el flujo exige acertar cada paso antes de avanzar. Evaluar si registrar intentos previos y ofrecer nuevas variantes discriminantes, en vez de calificar dominio basándose solo en haber llegado a la respuesta correcta.
- **Tutor sobre material:** con RAG de pago sin aprovisionar, el comportamiento no puede certificarse como orientación académica contextual. Hay que probar un corpus autorizado con fuentes y casos adversariales.
- **Live:** se comprobó que una clase de cohorte se lista con un enlace interno a aula. No se verificó llamada LiveKit real, cámaras, chat, permisos ni finalización.
- **Certificados:** que una lista vacía sea honesta no verifica emisión masiva ni firma electrónica.
- **Rendimiento y accesibilidad:** no se realizó Lighthouse completo, auditoría WCAG manual ni pruebas reales de VoiceOver. Se comprobaron geometría puntual y controles interactivos del recorrido.

## Contrato de ejecución para otro agente

1. Resolver P0 de UI estado persistente y acceso premium, con red/green Playwright por identidad y tenant.
2. Especificar y construir un `Course Player / Lesson Progress` que distinga lección, práctica evaluada, reflexión, sesión en vivo y certificado, con currículo publicado y objetivos medibles.
3. Crear «Mi curso» para compras activas; comprobar primer minuto mobile y desktop.
4. Añadir canal de ayuda humana o estado de reintento al tutor sin RAG.
5. Persistir reflexiones como datos auto-reportados separados de evidencia puntuable.
6. Completar pruebas auth SSO, Hotmart sandbox real, LiveKit, certificados y accesibilidad manual antes de certificar producto.

**Política de publicación:** no hacer merge ni deploy del bridge de QA sin revisión; su código solo se habilita en `NODE_ENV=development`, `demo-*` y Auth Emulator localhost. En producción debe no estar presente en el árbol de UI y se debe comprobar en CI.
