# Cloud security acceptance: facts and blockers

P0 CONFIRMED PROJECT CONFIGURATION: the project currently permits automatic room creation on participant join, evidenced by a synthetic orphan roomJoin JWT creating a room. It is not acceptable for LUMA end-for-everyone unless disabled.

P0 CLOSED IN BRANCH SOURCE: deleting a room by itself allows the instructor's still-valid cached JWT to recreate the room. The authenticated source now revokes the entire issued-token roster before deleting; Cloud replay test after fix rejects the original instructor JWT. The LUMA learner revocation path correctly expires both business access and the provider's cached learner JWT.

IMPORTANT PROVIDER SCOPE: RemoveParticipant with revokeTokenTs on LiveKit Cloud revokes tokens with earlier nbf. SDK refresh behavior over extended classes has not been independently tested. The project dashboard setting must still disallow automatic creation.

API credentials remain only in mode-600 local CLI config under a mode-700 sandbox directory and were passed as environment variables to the isolated QA child process. Files are scanned for raw API keys, JWTs, passwords and private keys before publication. No production Firebase test user was created.

The participant revocation path had sample operation durations ranging from about 2.1 to 33.3 seconds across separate trials. This variability is a significant SLO and incident-response acceptance risk. A retry worker, webhook reconciliation, bounded timeouts and larger load remain to be validated. Do not infer a percentile.

Independent Graph Harness review remains missing. A source unit test, a passing browser UI and a passing Cloud SDK test do not certify the deployment.
