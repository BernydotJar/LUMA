# LUMA × Hotmart — Simulación end-to-end de compra aprobada

**Fecha:** 2026-10-12
**Rama:** test/hotmart-paid-course-e2e-20261012
**Baseline:** main en commit 7ef32ba9ff3c56896da536a86ca14286b99ddfb3
**Veredicto:** PASS para API HTTP + Firebase Auth/Firestore Emulator; **NO veredicto de checkout/SSO real**.

## Alcance verificado

Esta ejecución simula que el cliente **ya pagó** Hotmart, emitiendo localmente un evento V2
\`PURCHASE_APPROVED\`. No se realiza cargo, compra real, redirección a Hotmart, email,
inscripción de un cliente real ni despliegue. El endpoint ejecutado **sí** es el handler
HTTP real de LUMA: \`POST /api/commerce/webhooks/hotmart\` en un servidor Next local.

Flujo:

1. Comprobar que un usuario sin compra recibe HTTP 403 en el aprendizaje protegido.
2. Crear mapeo de un producto Hotmart ficticio → programa Practitioner PNL del tenant QA.
3. Rechazar Hottok incorrecto (HTTP 401).
4. Simular compra aprobada con un Hottok **ficticio** de prueba.
5. Confirmar inscripción/entitlement activo y que un webhook repetido es idempotente.
6. Confirmar que solo el comprador con email Firebase **verificado** reclama el curso.
7. Negar acceso a un comprador distinto y a programas no adquiridos.
8. Inicializar onboarding y completar un ejercicio PAS mediante los endpoints reales.
9. Verificar Firestore \`version=2\` y recomendación actualizada con evidencia de la práctica.
10. Crear una **nueva sesión autenticada** y recuperar el mismo progreso del servidor, sin localStorage.
11. Verificar que un entrenador del tenant autorizado ve el progreso; otro tenant recibe HTTP 403.
12. Emitir un \`PURCHASE_REFUNDED\` ficticio, comprobar revocación y doble envío idempotente.

## Ejecución

En un worktree aislado con Node.js, dependencias del repositorio, Firebase CLI y **Java 21**:

\`\`\`bash
export JAVA_HOME=/opt/luma-jre21
export PATH="$JAVA_HOME/bin:$PATH"
export GCLOUD_PROJECT=demo-luma-hotmart-paid-e2e
export GOOGLE_CLOUD_PROJECT=demo-luma-hotmart-paid-e2e

firebase emulators:exec \
  --project demo-luma-hotmart-paid-e2e \
  --only auth,firestore \
  "bash scripts/qa-hotmart-purchase-e2e.sh"
\`\`\`

Se utilizan localhost:8085 (Firestore), localhost:9099 (Auth) y localhost:3285 (Next.js).
Requiere que los puertos estén disponibles y **no acepta** un proyecto que no empiece con
\`demo-\`. La prueba exige hosts de emulador localhost/127.0.0.1; usa un Hottok
ficticio, desactiva \`GOOGLE_APPLICATION_CREDENTIALS\` y configura
\`LUMA_LEARNING_ACCESS_MODE=entitled\` exclusivamente para el servidor local.

Tras la ejecución, \`firebase emulators:exec\` detiene los emuladores y descarta los
datos ficticios, mientras el script termina el proceso Next.js con una trampa de salida.

## Evidencia

- \`run-summary.json\`: resumen sanitizado exportado de \`E2E_REPORT\`.
- 22/22 verificaciones de flujo completo: **PASS**, confirmadas en dos ejecuciones independientes (44 aserciones en total).
- HTTP 200 para compra aprobada, acceso reclamado, evento de aprendizaje y refund.
- HTTP 401 por Hottok incorrecto y acceso anónimo.
- HTTP 403 para estudiante sin compra, otro programa y entrenador ajeno.
- Firestore con una inscripción reclamada y un expediente de progreso versionado.
- Emuladores apagados; sin procesos ni conexiones de prueba persistentes.

## Límites del resultado

- No prueba una venta real ni la configuración del webhook en la cuenta de Hotmart.
- No prueba la experiencia OAuth/Google Sign-In del comprador en Chrome o Edge.
- No demuestra la emisión de email de bienvenida, invitaciones o sesiones LiveKit.
- No demuestra el rendimiento bajo tráfico real ni certifica producción.
- El producto ficticio no necesariamente corresponde a un producto Hotmart real.
- En este test el mapeo producto→programa se provisiona directamente en el
  Firestore Emulator para no depender de permisos de un administrador de producción.
- Es un E2E **de APIs y persistencia**, no un E2E de navegador con usuario real.

Para un **pilot gate** comercial real, falta registrar un producto de sandbox en
Hotmart, un evento generado por el proveedor, validar red/secretos de ingreso,
Google Sign-In bajo tenant staging y completar una navegación autenticada,
incluyendo redirecciones, contenido visible y confirmación de acceso en el UI.

## Archivos

- \`scripts/qa-hotmart-purchase-e2e.sh\`: orquestación protegida de emuladores/servidor.
- \`scripts/qa-hotmart-purchase-flow.mjs\`: escenarios API, seguridad y revocación.
