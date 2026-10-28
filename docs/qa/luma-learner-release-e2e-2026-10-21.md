# LUMA — Alumno nuevo: correccion de hidratacion y aceptacion de publicacion

**Fecha:** 2026-10-21 (America/Guatemala)  
**Fuente base:** `main` `4b87923d87d045f938c42aeff02264cddee072d7`  
**Rama de correccion:** `qa/student-journey-e2e-20261021`  
**Estado del producto:** **NO-GO para promocion a produccion**. Una correccion probada localmente no equivale a un despliegue autorizado.

## 1. Criterio de aceptacion

Evaluar a una persona que llega por primera vez: login/onboarding, programa, primera practica, evidencia, recuperacion, asistente, certificados y sesiones. La decision exige: implementacion real, interfaz usable, persistencia por identidad y curso, proveedor externo cuando corresponda, paridad de SHA y evidencia reproducible. Un HTTP 200, CI verde o captura visual no son por si solos una funcionalidad terminada.

## 2. Hechos observados

| ID | Severidad | Comprobacion | Hallazgo / limite | Estado |
| --- | --- | --- | --- | --- |
| F-01 | P0 release | `GET /api/version` en Firebase y en `luma.lch-app.cloud` | Ambos publican `6ddcae8ff2464782b7e4001c4cd5d60092dbb099` (2026-10-10); `main` ya esta en `4b87923d87d045f938c42aeff02264cddee072d7`. El Cloudflare proxy no oculta un nuevo despliegue. | ABIERTO; ver issue #52 |
| F-02 | P1 UX/runtime | Navegar `/learn` publico con Playwright Chromium | Se observo `Minified React error #418` en cliente. El saludo dependia de `new Date().getHours()` en HTML prerenderizado y podia diferir del reloj del navegador. | CORREGIDO en rama; pendiente de publicacion |
| F-03 | P0 aceptacion comercial | UAT autenticada 070/071 | 13/13 escenarios PASS sobre `f1a0895` con emuladores Firebase, incluyendo dos cursos, evaluacion, persistencia, denegacion sin inscripcion y revocacion. Esto **no** certifica `main` ni proveedor real. | VALIDADO SOLO EN ENTORNO SINTETICO |
| F-04 | P0 producto | Alumno nuevo desde compra real hasta curso | La version publica permite recorrido invitado de onboarding y practica P.A.S.; la compra Hotmart, entitlement comercial y todas las videolecciones no quedaron aceptados en un E2E autentico de punta a punta. | PENDIENTE |
| F-05 | P0 producto | Tutoria, aula, certificados, privacidad | El tutor respaldado por RAG autorizado, clase real con LiveKit, entrenador y alumnos, certificado por reglas del emisor y cambio de cuenta sin fuga de evidencia requieren aceptacion fuente-especifica y en staging. | PENDIENTE |
| F-06 | P0 release | Graph Harness | Cadena canonica valida con 685 eventos. `LUMA-CICD-002-release-pipeline` se mantiene en `review`; una aprobacion historica de `cicd-release` no acredita el nuevo source digest ni el `cicd-production`. | BLOQUEADO |

### Contexto de la incidencia F-01

GitHub [issue #52](https://github.com/BernydotJar/LUMA/issues/52) documenta que un despliegue de `main` anterior fallo **antes de la promocion**, porque la fuente habia cambiado desde la revision independiente. El origen Firebase y el dominio publico permanecen coherentemente en el release verificado anterior. No modificar el tunel ni el upstream para simular un despliegue. El PR raiz de integracion [#71](https://github.com/BernydotJar/LUMA/pull/71) mantiene controles de paridad de ambos dominios bajo gate; no asumir que su codigo esta actualmente en `main`.

## 3. Correccion aplicada

Se portaron **solo** los archivos de remedio ya inspeccionados de la rama QA autenticada; no se fusionaron sus cambios de negocio ni se habilitaron flags empresariales. `LearnerGreeting` muestra texto inicial determinista (`Hola`) en render del servidor y en la primera hidratacion. Tras mount usa la zona horaria local mediante un efecto, actualizando al recuperar foco o visibilidad. El wrapper del saludo conserva una altura minima de 44 px durante el cambio de sesion. La regresion E2E cubre UTC, America/Guatemala y America/Los_Angeles en Chromium escritorio y movil, errores de runtime, duplicacion visible de CTA, ruta y recarga.

**No se modificaron** autenticacion, Firestore, matriculas, IA, facturacion, infraestructura, permisos, firma Ed25519, certificados ni LiveKit.

## 4. Reproduccion exacta

```bash
# Ejecutar desde este checkout, en un entorno de CI aislado:
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run build
CI=true PLAYWRIGHT_PORT=3392 npx playwright test --workers=2

# Otro checkout especifico (f1a0895), en emuladores; no homologar ambos SHA:
# firebase emulators:exec --project demo-luma-learning-uat-20261021 \
#   --only auth,firestore 'bash scripts/qa/run-learning-assessment-uat.sh'

# Grafos: ejecutar con Graph Harness instalado en PYTHONPATH
python3 -m graph_harness.cli --project graph-harness.project.json --events graph-harness.events.jsonl validate

# Verificar despliegue real, read-only:
curl -fsS https://luma.lch-app.cloud/api/version
curl -fsS https://luma--luma-learning-intelligence.us-central1.hosted.app/api/version
```

Las capturas y JSON completos de Playwright deben conservarse en los artifacts del run de CI sobre el SHA definitivo. El experimento de emuladores realizado anteriormente no corresponde al codigo revisado aqui y no constituye atestacion de esta rama.

## 5. Estado de pruebas del parche

- Build de produccion local Next.js 16.3.8: **PASS**.
- Playwright dirigido (`learner-hydration-stability`, `adaptive-loop`, `auth`): **15 PASS, 1 SKIP por viewport, 0 FAIL**.
- ESLint: **PASS**. TypeScript: **PASS**.
- Vitest: **331 PASS / 81 SKIP**, cero fallos; el alcance emulador no se cuenta como ejecutado.
- Suite completa Playwright desktop/mobile: **131 PASS / 7 SKIP, 0 FAIL, 0 flaky**, sobre el build local de produccion. JSON resumido en `evidence/learner-release-20261021/verification-summary.json`; nuevo GitHub CI sobre SHA final sigue siendo obligatorio.
- Graph Harness: **VALID** cadena de 685 eventos, release bajo revision, sin nueva firma ni autoaprobacion.

## 6. Condiciones necesarias para GO

1. Resolver la revision autentica e independiente del SHA final con custodio Ed25519 protegido, en virtud de los controles de #89. Ningun desarrollador aprueba su propia modificacion ni crea un recibo apocrifo.
2. Integrar y aceptar el contrato comercial academico completo: cuenta nueva, email verificado, compra/matricula real, seleccion 1/10/50 cursos, clases, tutor, feedback, progreso persistente, certificado valido y revocacion.
3. Ejecutar UAT real en un ambiente aislado con usuarios de prueba autorizados y LiveKit Cloud; verificar privacidad entre alumnos/organizaciones, refund y recuperacion de sesion.
4. Aprobar Graph Harness `predeploy` en el source digest final; promover exclusivamente mediante el pipeline protegido y verificar `postdeploy`, rollback y `api/version` en **ambos** dominios.
5. Mantener el release anterior `6ddcae8` como baseline verificado mientras no se cumplan las condiciones anteriores.

**Decision:** **GO tecnico limitado** para revision de la correccion SSR/hidratacion; **NO-GO produccion** y **NO-GO aceptacion integral del alumno nuevo**. Este documento no es una aprobacion de seguridad ni de un cliente real.
