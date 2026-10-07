# SE Voice production runtime

## Release binding

- LUMA main: `bfd4381754eefdc1fb6bccf75d35ac37f5d6d16f`
- Cloud Run service: `se-voice-runtime`
- Region: `us-central1`
- Ready revision: `se-voice-runtime-00002-456`
- Runtime image digest: `sha256:cb9286549de9f36ec4dd5f0473e8bee7f879911318b38dcdbc30fbe9a309d185`
- Runtime envelope: 4 vCPU, 8 GiB, concurrency 1, request timeout 300 s, max instances 2.

## Trust boundary

LUMA Firebase App Hosting calls the private Cloud Run service server-to-server with a Google OIDC identity token minted for the exact Cloud Run audience. Anonymous Cloud Run requests are rejected. The only `roles/run.invoker` principal is the Firebase App Hosting compute service account.

The runtime uses a dedicated service account. Firestore is canonical for voice profile, consent and audit metadata. Firebase Storage is canonical for authorized reference audio and generated WAV artifacts.

Production application routes are intentionally minimal:

- `GET /health`
- `POST /v1/speech`

Pilot, profile mutation, evaluation and docs surfaces are not exposed by the production runtime.

## Verification

The release passed:

- GitHub Product quality: lint, typecheck, unit tests, production build and Playwright.
- Cloud Run anonymous health request: 403.
- Authenticated health: 200.
- `/pilot`, `/v1/voices`, `/docs`: 404 in production mode.
- `mary_cardona`: 409 while documented consent/reference are not complete.
- `example_public`: real deployed synthesis returned `audio/wav`.
- Real production LUMA browser click on “Escuchar guía”: audio player rendered successfully.
- Independent Granite `ibm/granite3.3:2b`: release-risk `P/NONE`; ten-category enterprise rubric 10/10 `P`.

Text learning remains non-blocking when voice synthesis is unavailable.
