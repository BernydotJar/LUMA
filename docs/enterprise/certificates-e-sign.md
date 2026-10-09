# LUMA Enterprise — Certificados académicos con firma digital institucional

**Estado de ingeniería:** adaptador Stirling-PDF integrado en la rama de certificados, sin fusionar ni desplegar. **El alcance es de producción empresarial, no un MVP**, pero la liberación sigue sujeta a pruebas reales, seguridad, autorización y revisión de licencia. LUMA no afirma que un certificado exista hasta que el proveedor devuelva un PDF firmado cuya validez haya sido verificada y archivada.

## 1. Arquitectura y responsabilidades

```text
Entrenador -> POST /api/certificates/completions
  [matrícula cohorte + scope + nombre legal atestado + evaluación]
       |
       v
LUMA AcademicCompletion -- transacción Firestore, ID determinístico
       |
       v
LUMA CertificateService -- reserva UUID / PREPARING
  [requiere configuración del emisor + autorización automática del admin]
       |
       v
LUMA PDF generator -- PDF original privado + QR /verify/{uuid}
       |
       v
SignatureProvider = STIRLING (default)
  POST private /api/v1/security/cert-sign
  [fileInput PDF, certType PKCS12, p12File, password]
       |
       v
POST private /api/v1/security/validate-signature
  [signature valid, chain trusted, exact signer serial, full PDF covered,
   certificate not expired, OCSP/CRL checked, not self-signed]
       |
       v
Firebase Cloud Storage (privado): unsigned.pdf, signed.pdf, signature-validation.json
       |
       v
Firestore transaction: SIGNED + signed SHA-256 + immutable audit event
       |
       +--> aprendiz: /learn/certificates, PDF firmado autenticado
       +--> público: /verify/{uuid} (estado institucional sin acceso al PDF)
       +--> admin: revocación con motivo, historial conservado
```

**DocuSign sigue como adaptador opcional** mediante `CERTIFICATE_SIGNING_PROVIDER=docusign`. La ruta predeterminada de LUMA es `stirling` y no usa servicios pagos por documento. El modo institucional NO equivale a obtener una firma humana individual por cada diploma: el representante autoriza previamente a LUMA a firmar de forma automática por la institución.

## 2. Contrato real de Stirling-PDF

Revisado contra las fuentes del proyecto:
- [CertSignController.java](https://github.com/Stirling-Tools/Stirling-PDF/blob/main/app/core/src/main/java/stirling/software/SPDF/controller/api/security/CertSignController.java)
- [SignPDFWithCertRequest.java](https://github.com/Stirling-Tools/Stirling-PDF/blob/main/app/core/src/main/java/stirling/software/SPDF/model/api/security/SignPDFWithCertRequest.java)
- [ValidateSignatureController.java](https://github.com/Stirling-Tools/Stirling-PDF/blob/main/app/core/src/main/java/stirling/software/SPDF/controller/api/security/ValidateSignatureController.java)
- [SignatureValidationResult.java](https://github.com/Stirling-Tools/Stirling-PDF/blob/main/app/core/src/main/java/stirling/software/SPDF/model/api/security/SignatureValidationResult.java)

### Firma

`POST /api/v1/security/cert-sign` (multipart form-data):
- `fileInput`: certificado PDF original
- `certType`: `PKCS12`
- `p12File`: certificado + clave institucional en PKCS#12
- `password`: secreto de apertura del keystore
- `name`: institución emisora
- `showSignature=false`: firma criptográfica invisible. El PDF institucional de LUMA ya contiene una línea de firma visual.
- `reason`, `showLogo`: metadatos/imagen según contrato de Stirling

**No usamos `certType=SERVER`**, porque su servicio de certificado del servidor puede no estar disponible en la edición libre.

### Verificación obligatoria

`POST /api/v1/security/validate-signature` (multipart):
- `fileInput`: PDF recibido de la firma
- `certFile`: certificado raíz/intermedio confiable opcional definido por la organización

LUMA exige **exactamente una firma** y comprueba que:
- `valid` y `coversEntireDocument` sean verdaderos.
- `chainValid` y `trustValid` sean verdaderos.
- `notExpired` sea verdadero y `selfSigned` falso.
- `serialNumber` coincida con el certificado público institucional configurado. Una cadena válida de **otro** emisor no sirve.
- En modo estricto, `revocationChecked=true` y `revocationStatus=good`.
- Título, asunto `LUMA_CERTIFICATE:{uuid}` y cantidad de páginas coincidan con el documento que LUMA reservó.

Si la verificación falla, el estado no pasa a `signed`. Los errores del motor no se devuelven sin filtrar al cliente.

### Evidencia persistente

`signature-validation.json` registra exclusivamente datos no secretos: nombre del proveedor, UUID, tenant, SHA-256 del documento original y firmado, número de serie de certificado público, emisor, cadena, integridad, estado de revocación y fecha de validación. Un evento Firestore conserva el actor de la emisión y quien autorizó la firma institucional. **No es un Certificate of Completion de DocuSign** ni debe presentarse como tal.

## 3. Autorización y aislamiento

1. Un entrenador con asignación a cohorte y alcance de tenant debe atestar nombre legal, identidad revisada y resultados de aprendizaje.
2. Se verifica matrícula activa para el programa y la cohorte exactos y correo controlado/verificado en Firebase.
3. Un administrador institucional configura emisor y firma el consentimiento operacional marcando `institutionalSigningAuthorized`.
4. El certificado se vincula también al nombre legal `STIRLING_SIGNING_LEGAL_NAME` del emisor. El secreto PKCS#12 queda asociado exclusivamente al tenant `STIRLING_SIGNING_TENANT_ID`. No existe fallback a firmar usando el certificado de otra organización.
5. Cada aprobación solo puede reservar **un UUID** y repetir la solicitud no crea ni firma otro certificado.
6. En fallos ambiguos el registro pasa a `failed`: ninguna reemisión automática. La conciliación administrativa y la revalidación de los objetos almacenados son obligatorias antes de reintentar.
7. La descarga del PDF requiere ser el alumno titular; el verificador público solo publica nombre, programa, institución, estado y SHA-256 mediante un UUID difícil de enumerar.
8. Las revocaciones cambian el estado **institucional de la credencial**; no cancelan mágicamente una firma X.509 que ya fue aplicada. Se conserva el documento original firmado como evidencia histórica.

## 4. Configuración de producción

Usar Cloud Secret Manager o montajes privados con permisos mínimos. Jamás guardar keystore, contraseñas o token API en Git, archivos visibles al cliente ni trazas de HTTP.

```text
CERTIFICATE_SIGNING_PROVIDER=stirling
CERTIFICATE_STORAGE_BUCKET=<bucket privado de LUMA>
LUMA_PUBLIC_BASE_URL=https://luma.example.org

STIRLING_PDF_BASE_URL=http://stirling-pdf:8080
STIRLING_SIGNING_TENANT_ID=<tenant ID autorizado>
STIRLING_SIGNING_LEGAL_NAME=<nombre legal del emisor autorizado>

STIRLING_P12_PATH=/run/secrets/academic-signing.p12
# Alternativa exclusiva a PATH:
# STIRLING_P12_BASE64=<base64 del keystore PKCS12>
STIRLING_P12_PASSWORD=<secret manager>
STIRLING_SIGNER_CERT_PEM_BASE64=<certificado PUBLICO PEM en base64>
STIRLING_TRUST_ANCHOR_PEM_BASE64=<certificado CA raíz PUBLICO PEM en base64 opcional>

STIRLING_REVOCATION_POLICY=strict
STIRLING_API_KEY=<clave de API si Stirling habilita autenticación>
```

Por defecto solo se permiten URLs HTTP internas `localhost`, `127.0.0.1`, `stirling-pdf`. Cualquier otro hostname debe ser HTTPS, con acceso autenticado y restringido. `STIRLING_REVOCATION_POLICY=allow-unchecked` queda **prohibido en producción**.

El proveedor Stirling, por defecto, tiene `security.validation.revocation.mode: none`; por eso incluimos una plantilla `ops/stirling/settings.yml.example` que propone `ocsp+crl` y `hardFail: true`. Debe habilitarse en la configuración real y verificarse contra el formato de la versión instalada. Sin revocación verificable el motor **no puede emitir certificados válidos** en producción.

## 5. Infraestructura autoalojada

Plantilla: `ops/stirling/compose.yaml`, con imagen fijada mediante digest verificado, red Docker privada `luma_signing`, sin puertos publicados, límites de memoria y volúmenes de configuración.

**Dos topologías posibles:**
- Docker: LUMA y Stirling en el mismo bridge privado. URL interna `http://stirling-pdf:8080`.
- Firebase App Hosting + servicio de firma privado: Stirling desplegado en la infraestructura interna GCP con HTTPS, autenticación y políticas de ingreso y salida restringidas. El DNS `stirling-pdf` del Docker local no resuelve automáticamente desde Firebase App Hosting.

LUMA genera y archiva PDFs en Firebase/Google Cloud Storage. Stirling no necesita exponer su interfaz de usuario. El servicio solo tiene que recibir PDF + PKCS#12 por la ruta interna. Para evitar que un servidor compartido registre claves privadas, desactivar captura de body/logs/APM y mantener la red privada; en producción multi-host usar TLS con autenticación robusta. No instalar un certificado privado en un directorio público de Stirling.

### Nota legal de licencia

[LICENSE raíz](https://github.com/Stirling-Tools/Stirling-PDF/blob/main/LICENSE) declara MIT para código fuera de directorios excluidos; `app/core` contiene `CertSignController.java`. Sin embargo, `app/proprietary/`, `engine/` y otros directorios tienen licencias separadas. Por ello no asumimos que **cualquier imagen Docker** pueda utilizarse comercialmente sin licencia. Antes del deploy de LUMA, revisar el contenido de la imagen elegida, su plan de uso comercial y la implementación del endpoint firmado. Si se requiere, construir una distribución limitada al código bajo licencia permisiva, sin módulos restringidos.

No hay tarifa obligatoria por documento impuesta por la implementación del adaptador, pero hay costes de hosting, emisión y renovación de certificado CA, almacenamiento, sellado temporal, seguridad, operación y licencias que apliquen.

## 6. APIs LUMA

| Método | Ruta | Actor | Función |
|---|---|---|---|
| GET | `/api/certificates/console` | Entrenador con scope | Cohortes y matrículas |
| POST | `/api/certificates/completions` | Entrenador con scope | Atestación académica |
| PUT | `/api/certificates/issuers` | Admin | Emisor y consentimiento automático |
| POST | `/api/certificates` | Entrenador con scope | PDF + firma institucional + verificación + archivo |
| GET | `/api/certificates/{id}` | Titular/entrenador asignado | Estado |
| GET | `/api/certificates/mine` | Titular | Credenciales |
| GET | `/api/certificates/{id}/download` | Titular | PDF firmado con SHA-256 validado |
| GET | `/api/certificates/verify/{id}` | Público con UUID | Validez/revocación institucional |
| GET | `/verify/{id}` | Público con UUID | Página noindex |
| POST | `/api/certificates/{id}/revoke` | Admin | Revocación con motivo |
| POST | `/api/certificates/webhooks/docusign` | DocuSign HMAC | Solo si se habilita adaptador legado |

## 7. Gates de liberación

**No confundir pruebas con aceptación productiva.** Deben satisfacerse:

1. Revisar licencia de la distribución autoalojada y cualquier coste de comercialización de la imagen utilizada.
2. Crear certificado de prueba institucional con CA de prueba confiable y ejecutar `node scripts/certificates/stirling-smoke.mjs path/to/unsigned-test.pdf`. Probar contra el contenedor exacto fijado por digest.
3. Test E2E real: PDF generado, firma X.509 real, CA confiable, OCSP/CRL, hash, validación en Adobe Acrobat y/o validador PAdES independiente. Verificar que no se acepta certificado incorrecto, firma ausente, inválida o autocertificada.
4. Firestore + Storage emulator: atomicidad de las transacciones, aislamiento por tenant, concurrencia, fallos de almacenamiento, recuperación administrativa, audit trail.
5. Construcción de producción en CI aislado, Playwright UX/Firefox/Safari, PDF nombres largos/internacionales, WCAG.
6. Modelo de conservación y expiración documental, consentimiento y privacidad, autorización formal del uso automático de certificado de la institución y evaluación jurídica por país.
7. Observabilidad, alertas, cuotas de emisión, límites de tráfico y procedimiento de conciliación para fallos entre la firma y la confirmación en Firestore.
8. Plan multi-tenant: una credencial de firma por organización; la configuración de este adaptador usa **una sola institución por despliegue** y rechaza automáticamente todos los otros tenants.

### Lo que esta implementación todavía no pretende

- No presta un servicio de firma remota cualificada de personas físicas ni valida identidad jurídica por sí misma.
- No incluye HSM/PKCS#11 remoto, sello de tiempo RFC 3161 acreditado ni conservación avanzada PAdES-LTA. Son opciones posteriores que podrían exigir otro motor, licencia o servicio regulado.
- No garantiza capacidad operacional de miles de certificados hasta superar las pruebas de capacidad y encolado. La versión actual firma de forma síncrona y bloquea reintentos automáticos cuando el resultado es ambiguo.
- No afirma que el certificado institucional tenga validez jurídica en cualquier país, ni que esté desplegado en Firebase.

Para mayor detalle del gate y evidencia verificable, ver `evidence/certificates-esign-20261009/release-evidence.md`.
