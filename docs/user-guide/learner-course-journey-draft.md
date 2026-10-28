# Manual del participante — Practitioner PNL en LUMA

> **Borrador editorial para futuro Help Center.** Esta guía combina rutas observables con objetivos de producto todavía sujetos a QA. No entregar al cliente como manual definitivo hasta cerrar los gates de `course-learner-user-stories.md`.

## Tu primer día en LUMA

### 1. Comprueba tu inscripción

Después de completar tu compra en Hotmart, accede a LUMA usando la identidad del **mismo correo electrónico** asociado a la compra. El acceso se valida por correo verificado, curso y tenant; no necesitas volver a comprar en LUMA.

**Comportamiento confirmado en API emulada:** LUMA recibe el webhook Hotmart, vincula la compra al programa y permite reclamar la inscripción por correo verificado. **Pendiente por confirmar en navegador:** que el usuario vea una confirmación inequívoca de «Curso adquirido» con nombre, acceso y siguiente paso. La compra real en el entorno comercial no está probada.

### 2. Encuentra tu punto de partida

En **Mi aprendizaje** busca la práctica destacada, su duración y el acceso a **Explora tu programa**, **Consulta tu ruta** y **Pregunta a LUMA**.

Si nunca configuraste tu objetivo, entra a **Elige lo que quieres desarrollar**. El onboarding contiene cuatro pasos: objetivo, diagnóstico, disponibilidad de tiempo y resumen inicial. Puedes elegir gestionar emociones, transformar creencias o comunicarte mejor.

**Importante:** el diagnóstico y tu confianza reportada orientan las primeras recomendaciones; no prueban dominio por sí solos.

### 3. Explora tu programa

Abre **Explora tu programa**. Encontrarás siete módulos de Practitioner y experiencias digitales disponibles. Selecciona un módulo para ver su descripción y, cuando exista, un acceso a una práctica relacionada. También puedes abrir una experiencia por su título para consultar una idea clave, un caso y pasos de aplicación.

**Límite confirmado en el código:** estas tarjetas no son todavía un reproductor de todas las videoclases, ni aseguran que cada módulo tenga contenidos publicados, historial de lecciones y botón «Continuar video». La reproducción real, el orden obligatorio y el estado individual por clase forman parte del backlog.

### 4. Haz tu primera práctica evaluada

Una actividad disponible es **P.A.S.: detectar y reformular**. Presenta una situación y tres decisiones: identificar un pensamiento automático, relacionar la emoción y proponer una alternativa basada en evidencia.

Cuando eliges una respuesta, recibirás retroalimentación contextual. La actividad avanza cuando seleccionas la respuesta adecuada. Al terminar, LUMA registra los criterios aprobados y ofrece volver a tu ruta.

**Cómo leer el resultado:** una puntuación `3/3` demuestra los criterios de esta actividad. No significa que completaste Practitioner ni que recibiste una certificación.

### 5. Pregunta cuando no entiendas algo

Desde **Mi aprendizaje**, busca **Pregunta a LUMA**. Puedes preguntar, por ejemplo:

- «¿Cómo distingo un P.A.S. de un hecho observable?»
- «Dame otro ejemplo de reformulación».
- «¿Dónde encuentro el material original de este concepto?»

Cuando el corpus autorizado esté conectado, las respuestas deben indicar su origen y enlace relevante. Si no está disponible, LUMA debe informar la limitación en vez de inventar una respuesta. El acceso a un entrenador humano y su canal de soporte necesitan verificación comercial.

### 6. Consulta tus sesiones y progreso

Si tu inscripción pertenece a una cohorte con agenda, podrás consultar próximas sesiones en vivo y, cuando estén habilitadas, entrar al aula. Si no aparece una agenda, verifica con tu programa si la inscripción incluye clases sincrónicas y si ya se publicaron.

En **Tu progreso**, diferencia resultados de prácticas evaluadas, reflexiones auto-reportadas y el próximo paso recomendado. Las credenciales se consultan en **Mis certificados**. El certificado solo es válido cuando se cumplieron los requisitos del emisor; una práctica no lo genera automáticamente.

### 7. Regresa al día siguiente

Vuelve a LUMA con la misma cuenta. Tu progreso real debe recuperarse desde el servidor y mostrar qué sigue. Si ves «pendiente de sincronización» o falta una actividad, evita repetir pagos: reintenta la sesión o solicita apoyo.

**Pendiente de QA de interfaz:** verificar que el registro de práctica, la constancia visual y el siguiente paso reaparezcan al abrir un navegador nuevo sin depender de datos guardados en ese dispositivo.

## Preguntas frecuentes propuestas

**¿Compré en Hotmart, debo pagar otra vez?** No. LUMA consume la autorización de la compra; si no aparece el curso, debe confirmarse la coincidencia de correo y estado de la transacción.

**¿Por dónde empiezo?** En «Mi aprendizaje», desde la práctica principal o la configuración del objetivo, según tu punto de partida.

**¿Puedo avanzar más rápido?** Sí, las prácticas permiten avanzar según capacidad y tiempo. La disponibilidad de las lecciones siguientes está sujeta a publicación y reglas del programa.

**¿Por qué no puedo entrar a otro curso?** El acceso depende de la inscripción activa al producto correcto y de la organización que lo ofrece.

**¿Qué pasa si me equivoco?** Las actividades con retroalimentación permiten elegir otra respuesta. Los errores no deben generar avances falsos.

**¿Puedo preguntar por el material?** Sí, cuando el tutor del programa está configurado. Si el índice no está disponible, la aplicación debe indicarlo y orientar hacia el equipo del curso.

**¿Se guarda mi progreso?** Los eventos evaluados pueden persistir en Firestore, pero la consistencia de todos los indicadores visuales y reflexiones entre dispositivos debe superar la validación E2E.

**¿Qué pasa si me devuelven el dinero?** La autorización del contenido de pago se revoca conforme al evento comercial y sus reglas de vigencia.

**¿Dónde está mi certificado?** En «Mis certificados» cuando la institución lo haya emitido y la credencial cumpla las condiciones de verificación.

## Diseño de documentación futura

Cada paso debe acompañarse de: captura desktop y móvil real, nombre exacto del control, permiso necesario, resultado esperado, mensaje ante error, solución sin exponer información privada y vínculo al siguiente paso. Capturar solo datos sintéticos; la presente guía es un borrador de ayuda, no una certificación del estado del producto.

## Casos de documentación para revisión con usuarios

**Jeremy — ruta rápida:** tras la compra, quiere ver cuál curso posee, empezar en la primera lección, completar una práctica evaluada, hacer otras actividades y retomar sin perder la rúbrica. Los resultados de QA de octubre de 2026 todavía no permiten documentar este recorrido como finalizado.

**Abigail — ruta guiada:** empieza con ocho minutos, responde de manera incorrecta y recibe una pista útil. El manual deberá explicar los intentos y el resultado, sin atribuirle autonomía total por llegar a 3/3 después de recibir ayuda.

**Adán — ruta de exploración:** necesita consultar fuentes del material y dejar una reflexión. La guía debe describir cómo contactar a un tutor humano cuando el asistente no pueda responder y cómo recuperar sus reflexiones entre sesiones; ambas capacidades requieren cerrar hallazgos.

**Protección de datos compartidos:** antes de publicar el manual, QA debe verificar que al cambiar de alumno en un mismo navegador no se trasladen objetivos, evidencias ni respuestas de la cuenta anterior (P0: issue #49).
