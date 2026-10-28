# LUMA — Auditoría E2E con Jeremy, Abigail y Adán

**Fecha:** 13 de octubre de 2026. **User story:** US-LRN-001 (GitHub #46).
**Base de código:** main, SHA 7ef32ba9ff3c56896da536a86ca14286b99ddfb3.
**Estado:** Evaluación del curso completo: **NO-GO**, requiere correcciones.
**Alcance:** servidor HTTP real de Next.js, navegadores Playwright Chromium, Firebase Auth y Firestore Emulator en proyecto demo. No hubo compra en Hotmart, OAuth Google real, tráfico productivo ni cuentas humanas.

## Objetivo de cada participante

| Alumno | Punto de partida | Recorrido que se ejecutó |
| --- | --- | --- |
| **Jeremy** | Experiencia alta, 35 minutos, confianza 5/5, diagnóstico correcto | Recibe compra simulada, entra, ve cohorte, hace onboarding, recorre los módulos, obtiene 3/3 en PAS, realiza dos reflexiones adicionales, pregunta a LUMA y vuelve desde otra sesión |
| **Abigail** | Principiante, 8 minutos, diagnóstico incorrecto | Recibe compra, elige objetivo, comete un error, recibe pista, corrige, completa PAS; se comprueban rúbrica e intentos |
| **Adán** | Investigador y participante activo | Recibe compra, consulta por fuentes al tutor, plantea una pregunta médica de alto impacto, envía reflexión auto-reportada y vuelve en otro navegador |

Se mantuvieron Julián (sin compra), Sofía (coach del tenant) y un coach de tenant ajeno para las pruebas negativas. Mariana permanece exclusivamente como demostración. Todos los registros e identidades son sintéticos y desechables.

## Resultado medido

| Suite | Total | PASS | FAIL | Observación |
| --- | ---: | ---: | ---: | --- |
| E2E completo: navegador + API + emuladores | 43 | 30 | 13 | Nueve brechas CX/funcionales, una prueba de certificado inestable y tres controles afectados por cierre inesperado de Chromium |
| Retest de cambio de cuenta en navegador aislado | 7 | 4 | 3 | Confirma exposición del objetivo, puntuación y almacenamiento local de Jeremy a Abigail; certificados y viewport móvil pasan |

**Evidencia reproducible:** evidence/qa-course-journey-jeremy-abigail-adan-20261013/run-summary.json y isolation-recheck.json. Scripts: scripts/qa-course-journey-runner.mjs, scripts/qa-course-isolation-recheck.mjs, scripts/qa-course-journey-e2e.sh.

Los scripts distinguen fallos de criterios (exit 1), bloqueos del harness (exit 2) y aprobación completa (exit 0). Los servicios locales se cierran tras finalizar.

## Qué experimenta realmente el alumno

**Jeremy entra:** encuentra «Mi aprendizaje», práctica sugerida, atajos, agenda del programa y acceso al tutor. La sesión de su cohorte aparece después de la matrícula. El nombre del curso adquirido no figura claramente como tarjeta propia de compra confirmada.

**Jeremy busca una clase:** ve siete módulos y fichas de práctica, pero en la ficha revisada no hay reproductor de videolección con marcador persistente. Cubiertas de módulos no equivalen a clases completables.

**Jeremy progresa:** completa la actividad PAS con 3/3; la evidencia llega a Firestore (versión 2). Tras dos reflexiones auto-reportadas, la pantalla pierde el recibo puntuado anterior, aunque el servidor todavía lo conserva. En otro navegador, el plan se recupera desde Firestore pero el panel visual no muestra los tres criterios.

**Abigail necesita ayuda:** el sistema le ofrece una pista útil. La rúbrica registra dos intentos en el primer criterio, luego recibe 3/3 al superar los tres pasos. El recibo final no distingue suficientemente ese resultado de una ejecución independiente al primer intento.

**Adán pregunta:** el tutor no inventa referencias cuando falta el índice RAG autorizado. Ante una afirmación de salud de alto impacto, aplica el bloqueo de afirmaciones sin verificación independiente. La reflexión de Adán se clasifica honestamente como auto-reportada, pero no se restaura en otro dispositivo.

**Sofía acompaña:** consulta los resultados de Jeremy como entrenadora autorizada. El coach de otro tenant recibe HTTP 403. Julián, sin matrícula, recibe HTTP 403 de la API de aprendizaje, aunque las rutas de prácticas públicas siguen accesibles sin un estado visual de bloqueo inequívoco.

## P0 confirmado: privacidad entre cuentas del mismo navegador

La prueba aislada, sin presión de memoria, reprodujo lo siguiente:

1. Jeremy inicia sesión y visualiza un objetivo y una rúbrica PAS 3/3 sintéticos mediante las claves locales que utiliza la aplicación.
2. Se cierra su sesión y Abigail inicia una sesión Firebase con su propia identidad en **el mismo navegador**.
3. La interfaz muestra correctamente que ahora está Abigail, pero también presenta el objetivo y la rúbrica que pertenecían a Jeremy.
4. Las claves locales del alumno anterior siguen sin invalidarse o particionarse por identidad.

**Es una exposición de datos en el cliente**, no una evasión constatada de los permisos Firestore. Debe corregirse antes de publicar para usuarios reales. Seguimiento: [P0 privacidad #49](https://github.com/BernydotJar/LUMA/issues/49).

## Prioridades de producto

| Prioridad | Defecto / gap | Issue |
| --- | --- | --- |
| P0 | Estado de aprendizaje local sin partición por UID/tenant/programa expuesto tras cambio de cuenta | [#49](https://github.com/BernydotJar/LUMA/issues/49) |
| P0 | Reflexiones recientes desplazan el recibo PAS puntuado, y UI de otra sesión no reconstruye los criterios del servidor | [#47](https://github.com/BernydotJar/LUMA/issues/47) |
| P0/P1 | Distinguir formalmente preview público, recursos premium y control server-side del material exclusivo | [#47](https://github.com/BernydotJar/LUMA/issues/47) |
| P1 | Mostrar claramente curso comprado, inscripción activa y próximo paso | [#48](https://github.com/BernydotJar/LUMA/issues/48) |
| P1 | Convertir los siete módulos editoriales en unidades publicadas con material reproducible y reanudación | [#48](https://github.com/BernydotJar/LUMA/issues/48) |
| P1 | Tutor sin RAG: ruta a ayuda humana, reintento o material autorizado | [#48](https://github.com/BernydotJar/LUMA/issues/48) |
| P1 | Diferenciar en la rúbrica la ejecución independiente de los aciertos después de pistas | [#48](https://github.com/BernydotJar/LUMA/issues/48) |
| P1 | Guardar reflexiones auto-reportadas en expediente autorizado, sin inflar resultados puntuados | [#48](https://github.com/BernydotJar/LUMA/issues/48) |

## Gates para el manual del participante

Para **Jeremy**, el manual solo puede prometer «Continuar con el curso» cuando exista una lección real, un recurso autorizado y la evidencia se vea intacta después de explorar otras actividades o cambiar de dispositivo.

Para **Abigail**, debe explicar la diferencia entre hacer una práctica con pistas y demostrar autonomía, además de localizar un próximo paso que quepa en 8 minutos.

Para **Adán**, debe indicar exactamente cómo preguntar y cómo encontrar fuentes; cuando el corpus autorizado no está configurado, debe mostrar una vía accionable de ayuda.

Para todos, la guía final requiere capturas de UI real aprobada, textos exactos de los controles, estados de falta de acceso, confirmación de compra y recuperación. El borrador está en docs/user-guide/learner-course-journey-draft.md.

**No probado:** cobro real Hotmart, Google Sign-In real, clases LiveKit con audio/video, lectura íntegra de los siete módulos, certificado firmado después de cumplir requisitos, Lighthouse/RUM, VoiceOver. No confundir la simulación PAS con la finalización del programa.
