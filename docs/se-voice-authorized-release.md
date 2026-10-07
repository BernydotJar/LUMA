# Authorized SE voice release gate

The production voice runtime is available, but switching LUMA from `example_public` to a named real-person voice is a separate governed release.

## Required sequence

1. **Documented consent** — explicit evidence file, verifier identity, timestamp and allowed uses. The evidence bytes are SHA-256 bound and stored in private canonical storage.
2. **Authorized reference audio** — ingestion is blocked until consent is verified. Audio must pass duration, sample-rate, clipping and RMS gates, then be SHA-256 bound in Firebase Storage.
3. **Candidate evaluation** — the exact reference SHA and runtime image digest are evaluated for identity, naturalness, pronunciation, prosody and artifacts.
4. **Human release approval** — a designated reviewer approves the exact candidate tuple. Automated evaluation does not substitute for approval.
5. **LUMA activation** — only then may `SE_VOICE_DEFAULT_VOICE` change from `example_public` to the authorized voice id, followed by CI, browser and production smoke.

## Current Mary Cardona state

`mary_cardona` remains fail-closed:

- status: `awaiting_authorized_reference_audio`
- consent: `pending_documented_consent`
- allowed uses: none
- reference SHA: none
- canonical reference object: none

No consent is inferred from ownership of source media, team affiliation, access to training material, or prior conversations. Until explicit evidence and an authorized reference are recorded, the production runtime must continue returning 409 for this profile.
