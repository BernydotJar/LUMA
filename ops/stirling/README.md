# LUMA private Stirling-PDF signing engine

This is a private Docker deployment template, **not** a public PDF editor. The production source image must be reviewed for license scope. The root MIT license excludes `engine/` and proprietary modules. See `docs/enterprise/certificates-e-sign.md` before commercial usage.

## Docker topology

LUMA and Stirling must be on the **same private Docker bridge**, with no externally published ports. LUMA authenticates callers, validates approvals and sends PDFs for signing.

```sh
docker network create luma_signing
export STIRLING_IMAGE='docker.stirlingpdf.com/stirlingtools/stirling-pdf@sha256:<reviewed-digest>'
docker compose -f ops/stirling/compose.yaml up -d
```

The digest placeholder is deliberate: this repository does **not** assume a license-approved, audited image version. Resolve a digest from an approved Stirling image and set it in your deployment environment.

Stirling API base inside the network: `http://stirling-pdf:8080`.

**Important:** LUMA on Firebase App Hosting **cannot reach this Docker hostname** unless it shares the network through an authorized private networking arrangement. For managed GCP deployments, run the signing workload privately (e.g. internal ingress on Cloud Run with identity-aware access or VPC) and use an authenticated HTTPS URL. Do not publish Stirling's all-tools HTTP service directly on the internet.

The `.p12` and its password live **only in LUMA's server-side secret manager or private mount**. This compose deliberately does not mount the keystore in the Stirling container. It is transmitted with a single signed request to the core API, over a private channel; for cross-host traffic use TLS. Keep access logs, traces and request body capture disabled on that endpoint.

## Smoke acceptance

After deploying a license-approved image and configuring a nonproduction institutional test certificate, run the signing smoke from the same private network using the script described in the enterprise architecture. Verify both the returned PDF and `validate-signature` response with a trusted root. Never test with a live institutional signing key without explicit issuer authorization.

Additional controls: bound CPU/memory, storage retention and cleanup, image vulnerability scanning, update cadence, no internet ingress, outbound OCSP/CRL trust checks, secret rotation and operational monitoring.
