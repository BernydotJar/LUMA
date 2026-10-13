# LUMA — Matriz de aceptación E2E del ciclo completo del curso

> **Ejecución histórica del 12 de octubre:** usa las identidades Valeria/Andrés/Natalia. Para la ejecución actual con Jeremy, Abigail y Adán, ver course-journey-jeremy-abigail-adan-2026-10-13.md. No sustituir resultados históricos retroactivamente.

**ID:** QA-LRN-001 · **Alcance:** compra simulada, usuario real del navegador con Auth Emulator, navegación, prácticas, coach y regresos a LUMA.
**Fuente:** `evidence/qa-course-journey-20261012/run-summary.json` (resultados calculados al finalizar).
**Historia de usuario:** `docs/product-experience/course-learner-user-stories.md`.
**Regla de interpretación:** HTTP 200/DOM renderizado no significan "curso cursable" por sí solos.

## Recorridos y criterios

| ID | Persona / momento | Esperado | Tipo de control | Estado |
| --- | --- | --- | --- | --- |
| QA-01 | Invitado llega sin comprar | Distingue catálogo de contenido bloqueado | Browser + copy | **FAIL**, falta estado de bloqueo |
| QA-02 | Compradores Valeria / Andrés / Natalia | Webhook Hotmart habilita matrícula correcta | HTTP + Auth/Firestore Emulator | **PASS** |
| QA-03 | Valeria primer ingreso | Reconoce el curso adquirido y CTA | Browser | **FAIL**, no identifica claramente el producto |
| QA-04 | Valeria accede a cohorte | Ve sesión próxima asociada al producto | Browser + backend scoped | **PASS** |
| QA-05 | Valeria configura ruta | Diagnóstico, objetivo, duración guardados | Browser + API Firestore | **PASS** |
| QA-06 | Valeria explora currículo | Ve siete módulos y entra a la práctica PAS | Browser | **PASS** |
| QA-07 | Valeria cursa una videoclase | Reproductor y marcador retomable por lección | Browser | **FAIL**, ficha de práctica no incluye lección reproducible |
| QA-08 | Valeria demuestra | 3/3 criterios rubricados y guardados | Browser + Firestore | **PASS** |
| QA-09 | Valeria pregunta a LUMA | Respuesta sustentada en material del curso | Browser + API | **BLOCKED**, índice RAG pago deliberadamente no configurado en QA |
| QA-10 | Valeria tutor sin corpus | Informa indisponibilidad y ofrece alternativa humana | Browser | **PARTIAL**, aviso honesto sin escalamiento claramente accionable |
| QA-11 | Valeria ve certificados | No recibe diploma después de una sola práctica | Browser + API | **PASS** |
| QA-12 | Valeria regresa desde otro navegador | Recupera expediente y muestra criterios en UI | Browser + Firestore | **PARTIAL / FAIL UI**, servidor retiene el evento; UI nueva no reconstruye ProgressStory |
| QA-13 | Andrés empieza con dudas | Puede elegir 8 min, diagnóstico no acertado y observar una pista | Browser | **PASS** en iteración estabilizada |
| QA-14 | Natalia pide ayuda | Tutor no inventa fuentes inexistentes | Browser + HTTP | **PASS** (indisponibilidad legítima cuando no hay corpus) |
| QA-15 | Natalia registra reflexión | Es auto-reportada, no dominio certificado | Browser | **PASS** |
| QA-16 | Natalia cambia dispositivo | Su reflexión puede recuperarse | Browser + backend | **FAIL**, reflexión guardada solo en localStorage |
| QA-17 | Julián no ha comprado | API no da acceso a aprendizaje | HTTP | **PASS 403** |
| QA-18 | Julián ve catálogo | Interfaz no permite completar contenido premium sin inscripción | Browser | **FAIL**, rutas de prácticas explorables sin entitlement visual |
| QA-19 | Sofía entrenadora | Puede observar evidencia de Valeria, no datos ajenos | HTTP + browser | BLOCKED: fixture Auth Emulator pierde token al cambiar de ruta; repetir en suite separada |
| QA-20 | Entrenador de otro tenant | Acceso denegado incluso con ID válido | HTTP | PASS: HTTP 403 |
| QA-21 | Cambio Valeria → Andrés en mismo dispositivo | No muestra ni persiste evidencia privada de Valeria | Browser | PASS: cambio de cuenta probado |
| QA-22 | Móvil 390×844 | CTA de práctica utilizable sin navegación superpuesta | Geometría DOM | PASS: viewport 390x844 medido |

## Capas QA realmente ensayadas

- **HTTP end-to-end local:** Next.js 16 en localhost, Firebase Auth y Firestore Emulator `demo-*`, producto ficticio Practitioner PNL, matrícula correcta.
- **UI automatizada:** Playwright Chromium con sesiones Firebase Emulator separadas; acciones reales sobre botones, formularios, prácticas y tutor. Los errores de hidratación y carrera se separan del comportamiento de producto mediante esperas de readiness.
- **Persistencia:** reingreso con nueva sesión/usuario, verificación de `/api/learning/plan` y contadores Firestore.
- **Datos:** Valeria (avanzada), Andrés (principiante), Natalia (pregunta/reflexión), Julián (sin compra), Sofía y coach ajeno; **no hay escrituras en datos reales ni identidad Mariana**.
- **Límites:** no sandbox comercial verdadero, no flujo OAuth Google real, no sesión audiovisual LiveKit, no ciclo académico completo de siete módulos, no firma/certificación real, no VoiceOver manual, no mediciones RUM.

## Defectos agrupados por capacidad (independientes del número de fallos en la suite)

1. **P0 — Identidad y evidencia:** el progreso/puntuación recuperable desde el backend no reaparece en ProgressStory desde otro navegador; la UI usa el evento local.
2. **P0 — Acceso de aprendizaje:** APIs de pago correctamente limitadas, pero el catálogo, vistas de práctica y simulación son navegables sin matrícula; definir frontera público/demostración/pago y bloquear material premium **antes** de piloto comercial.
3. **P0 si se reproduce — cambio de cuenta:** comprobar que cache/eventos localStorage no trasladan progreso entre identidades.
4. **P1 — Orientación:** al volver del pago no hay tarjeta clara «Ya tienes Practitioner PNL; empieza aquí» ni estado de curso adquirido.
5. **P1 — Finalización del curso:** los siete módulos son navegación editorial y varias prácticas son reflexiones; no todos representan lecciones reproducibles, con finalización por módulo y posición guardada.
6. **P1 — Tutor del programa:** requiere índice RAG bajo tenant; indisponibilidad honesta cuando falta, pero sin canal explícito al entrenador o a soporte.
7. **P1 — Reflexiones:** estado auto-reportado correcto, pero queda en localStorage en vez de expediente del servidor.
8. **P1 — Ayuda/temporalidad:** agenda depende de oferta/cohorte y servicio LiveKit; un enlace visible no demuestra que una videoclase funcione realmente.

## Gate recomendado

**37 checks: 28 PASS, 9 FAIL (dos fallos de Sofía requieren aislamiento del fixture QA).**

**NO-GO para un piloto vendido como LMS de curso completo** hasta resolver las capacidades P0, probar lecciones reproducibles/persistencia, contratar/provisionar corpus autorizado de tutor y validar un proceso real de compra sandbox y firma/certificado. Los escenarios ya funcionales (adaptación inicial, práctica PAS, evidencia Firestore, agenda, vistas de coach) forman una base sólida, pero no sustituyen la terminación total del programa.

**Principio de documentación al usuario:** solamente publicar pasos que haya confirmado QA en el ambiente real de despliegue del cliente; para capacidades pendientes incluir estado explícito y no presentarlas como ya disponibles.
