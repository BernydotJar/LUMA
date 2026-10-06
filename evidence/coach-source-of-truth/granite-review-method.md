# Granite Review Method — Coach Source of Truth

- Critic model: `ibm/granite3.3:2b`
- Mode: adversarial Product Owner + security review
- Critic verdict: `PASS_WITH_RISKS`
- Requested attack surfaces: horizontal privilege escalation, fake showcase substitution, learner/coach Next Best Action drift, PII exposure, direct Firestore bypass, stale local authority, and unsafe production claims.
- A separate Granite 4 verifier was attempted but exceeded the local CPU/runtime envelope and produced no artifact.
- Release authority: deterministic emulator/browser/build/security gates, independently adjudicated.
