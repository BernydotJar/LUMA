# LUMA Enterprise — Credenciales académicas con firma electrónica

**Estado:** módulo integrado en rama de desarrollo. Tipo de entrega: capacidad empresarial, no un certificado decorativo, MVP ni prueba de concepto. **Producción condicionada a aceptación técnica, jurídica y operativa**, con proveedor y firmante reales; las pruebas locales no sustituyen la firma de un documento real.

## 1. Contrato de producto

LUMA genera un certificado académico cuando una persona autorizada acredita la finalización de un programa y un representante autorizado del emisor firma el documento a través de un proveedor externo. La emisión está vinculada a un **tenant**, un **programa**, una **cohorte** y una **persona identificada**.

- El entrenador aprueba explícitamente el aprendizaje, confirma personalmente el nombre legal contra registros institucionales y registra el criterio. Ese nombre se congela en la aprobación. LUMA no infiere automáticamente el éxito de visualizaciones, asistencia, respuestas de IA o compras.
- LUMA verifica que la matrícula está activa en la cohorte exacta y que la identidad del aprendiz es verificable.
- Un administrador registra la razón social, nombre y correo del firmante autorizado.
- LUMA construye el PDF institucional con ID único, QR, nombre, programa, institución y fecha.
- El documento se remite a **DocuSign eSignature** para su firma real; *pendiente* y *firmado* son estados distintos.
- DocuSign confirma la finalización. El listener verifica HMAC y consulta independientemente el sobre completado; después archiva el PDF firmado y el Certificate of Completion del proveedor en almacenamiento privado.
- LUMA verifica SHA-256 al entregar el PDF al titular, publica el estado válido solo después de archivar la firma y permite revocación con motivo/auditoría.
- La verificación pública no permite descargar el PDF ni revela UID, correo, nombre del firmante, storage keys o respuestas internas del proveedor.

**Aclaración jurídica:** los distintos niveles de firma (simple, avanzada, cualificada, certificada) tienen requisitos específicos. Este módulo usa la firma provista por DocuSign y su rastro de auditoría; no afirma automáticamente que toda firma alcanzará el estándar de *firma digital certificada* o su equivalente en todas las jurisdicciones. El alcance legal y la identidad/apoderamiento del firmante requieren validación contractual y jurídica por país.

## 2. Arquitectura

```text
Coach autorizado / Admin (Firebase Auth)
   | aprobar finalización (rationale, learner evidence ownership)
   v
LUMA API / AcademicCompletion  -- Firestore transaction, deterministic id
   | emisión autorizada: cohort + tenant + active enrollment + verified identity
   v
AcademicCertificates record (PREPARING) -- UUID, unique and idempotent
   | PDF institucional, QR /verify/{uuid}
   v
Private Cloud Storage (unsigned.pdf)
   | JWT OAuth + request signature
   v
DocuSign eSignature -> firma humana en email institucional
   | Connect JSON event (HMAC verified)
   v
LUMA webhook -> GET envelope status COMPLETED from provider
   | retrieve signed PDF + provider Certificate of Completion
   v
Private Cloud Storage (signed.pdf, signature-evidence.pdf)
   | SHA256, Firestore transaction
   v
SIGNED -> /verify/{id} valida / titular descarga PDF autenticado
   |
Admin REVOKE -> REVOKED (evidencia histórica preservada)
```

### Entidades Firestore

| Colección | Qué conserva | Acceso |
|---|---|---|
| `academicCertificateIssuers/{tenantId}` | razón social y firmante oficial (configuración vigente) | solo Admin SDK |
| `academicCompletions/{sha256(tenant, offering, learner)}` | finalización firmada por entrenador, fundamento y referencias a evidencia | solo servidor, transaccional |
| `academicCertificates/{uuid}` | contrato de certificación, estado, proveedor, rutas privadas, hashes y revocación | solo servidor |
| `academicCertificates/{uuid}/events/{eventId}` | eventos de firma, archivado y revocación | solo servidor |
| Cloud Storage `academic-certificates/{tenant}/{uuid}/` | borrador, PDF firmado y evidencia del proveedor | bucket privado, sin URLs públicas |

Las reglas Firestore del proyecto bloquean accesos directos de cliente; todas las acciones pasan por API con Firebase ID token y autorización contextual.

### Máquina de estados

```
                preparing
                   |
           enviado a firma
                   v
            pending_signature
              /          \
        falla/         Connect validado + PDF y evidencia archivados
           v                    v
         failed                signed
      conciliación               |
                               revocar
                                  v
                                revoked
```

Se impide que una solicitud repetida genere un segundo certificado para la misma aprobación. Un error ambiguo de red o persistencia no inicia automáticamente otro sobre DocuSign: requiere conciliación. La vigencia de una credencial **nunca** deriva de un webhook sin validación de firma y de la consulta independiente del estado del sobre.

## 3. APIs

| Método | Ruta | Actor | Función |
|---|---|---|---|
| `GET` | `/api/certificates/console` | Coach + scope | Cohortes asignadas, listado paginado de alumnos |
| `POST` | `/api/certificates/completions` | Coach autorizado | Registrar finalización verificando matrícula y evidencia |
| `PUT` | `/api/certificates/issuers` | Admin | Establecer institución y firmante (no crea consentimiento DocuSign) |
| `POST` | `/api/certificates` | Coach autorizado | Reservar certificado, crear PDF, solicitar firma, devolver estado |
| `GET` | `/api/certificates/{id}` | Alumno titular / Coach asignado | Estado de firma y verificación |
| `GET` | `/api/certificates/mine` | Alumno titular | Mis certificados archivados |
| `GET` | `/api/certificates/{id}/download` | Alumno titular | Descargar únicamente PDF firmado íntegro |
| `GET` | `/api/certificates/verify/{id}` | Público con UUID | Validez o revocación, sin datos internos |
| `GET` | `/verify/{id}` | Público con UUID | Página de verificación `noindex` |
| `POST` | `/api/certificates/{id}/revoke` | Admin | Revocar con motivo auditado |
| `POST` | `/api/certificates/webhooks/docusign` | Connect autenticado HMAC | Conciliar sobre completado, archivado |

Las APIs privadas exigen el Firebase ID token (Authorization Bearer). Los IDs no son un mecanismo de autorización. IDs de Firebase, matrículas y eventos se contrastan en el servidor.

## 4. Entornos y secretos

Configurar exclusivamente en el administrador de secretos del servidor, **jamás en cliente, Git o `NEXT_PUBLIC_*`**:

```text
LUMA_PUBLIC_BASE_URL=https://luma.yourdomain.tld
CERTIFICATE_STORAGE_BUCKET=<private-bucket>

DOCUSIGN_ACCOUNT_ID=<Docusign API account UUID>
DOCUSIGN_INTEGRATION_KEY=<Docusign app integration key>
DOCUSIGN_IMPERSONATED_USER_ID=<Docusign authorized sender GUID>
DOCUSIGN_PRIVATE_KEY_PEM=<PKCS8 RSA private key PEM, newline-escaped if env>
DOCUSIGN_OAUTH_HOST=account.docusign.com
DOCUSIGN_API_BASE_URL=https://<account-specific-host>.docusign.net/restapi
DOCUSIGN_CONNECT_HMAC_SECRET=<Connect HMAC key>
```

Para entorno de desarrollador usar `account-d.docusign.com` y `https://demo.docusign.net/restapi`. El emisor debe autorizar la integración y otorgar consentimiento para JWT impersonation. Producción requiere cuenta habilitada, consentimiento otorgado, API base exacta de la cuenta y webhooks Connect JSON `envelope-completed` con HMAC. Habilitar reintentos de Connect, alertas sobre entregas fallidas y secreto rotado.

**No se generan, almacenan ni manejan claves privadas del firmante en LUMA.** La clave JWT corresponde a autenticación servidor→proveedor, y se gestiona en secret manager. La firma la ejecuta el proveedor con el consentimiento y los controles elegidos en su producto.

## 5. Operación empresarial y controles de release

**Controles presentes en código**
- Tenant y cohorte explícitos con claims de entrenador + asignación real en la cohorte; admin separado.
- El correo verificado se comprueba con Firebase Admin; el nombre legal se obtiene de la atestación explícita del entrenador contra registros institucionales y queda congelado, sin depender del nombre de perfil editable. Un correo verificado no constituye por sí solo prueba de identidad legal.
- Matrícula activa exacta + aprobación de finalización antes de solicitar firma.
- Emisión idempotente por hash de finalización y UUID de credencial.
- Firma solo por proveedor; callback HMAC, consulta de estado completado, PDF y evidencia del proveedor descargados y almacenados.
- Huella SHA-256 del PDF firmado, verificada antes de servir al titular.
- Verificador público no indexable; revocación, trazabilidad y documentos archivados no públicos.
- Errores operativos sin mensajes sensibles expuestos; descarga con `no-store`.

**Gates de despliegue para producción (aún requieren evidencias independientes)**
1. Firma real con cuenta DocuSign de la organización y firmante legalmente autorizado; proveedor exacto y categoría legal de e-sign confirmada por país.
2. E2E automatizado: instructor asignado/no asignado, matrícula y cambios de estado, integración del proveedor, callbacks duplicados/fuera de orden/ilegítimos, errores de almacenamiento, revocación y descargas no autorizadas.
3. Emuladores/ambiente aislado para transacciones Firestore y políticas de Google Cloud Storage; cargas, concurrencia y recuperación del estado `failed`.
4. Reconciliación administrada y alertas operativas de transacciones atascadas; retención de PDF/auditoría, backups y acceso administrativo.
5. Seguridad: validación y rotación de secretos, firma y evidencia originales, escaneo de dependencias, rate limits globales, retención y minimización de PII.
6. QA de experiencia de certificados en Safari/iOS/Android, WCAG y PDF multipaís/nombres largos; aprobación jurídica del texto y del alcance de la certificación.
7. Pruebas de go-live y configuración reales sin logs de secreto ni enmascaramiento del estado de firma.

### Advertencias de alcance

- El validador LUMA verifica **estado institucional y hash del archivo**, no sustituye un validador criptográfico PAdES ni a una autoridad de certificación. Un requisito de firma avanzada/cualificada necesita proveedor y comprobador legal apropiados.
- La publicación de nombre + logro mediante URL compartible necesita políticas de privacidad y consentimiento/autorización de la institución según ley aplicable.
- Paginar más allá de 100 credenciales por alumno y más de 100 cohortes en consola es un requisito de escalado para organizaciones grandes.
- Los eventos de aprendizaje disponibles hoy no codifican todos los criterios de finalización por programa: la evidencia y su pertinencia académica siguen bajo la responsabilidad explícita del entrenador.

## 6. Pruebas hasta el momento

Se agregaron pruebas unitarias independientes para separación tenant/cohorte, validación de aprobación, estados no publicables, autenticidad de HMAC, detección del evento esperado y creación real de PDF A4 con QR. Las pruebas de conectividad externa y cumplimiento jurídico requieren aprobación y credenciales reales.

Referencias técnicas: [Docusign Connect](https://developers.docusign.com/platform/webhooks/connect/), [Firma remota por API](https://developers.docusign.com/docs/esign-rest-api/how-to/request-signature-template-remote/), [Docusign Auth](https://developers.docusign.com/platform/auth/).
