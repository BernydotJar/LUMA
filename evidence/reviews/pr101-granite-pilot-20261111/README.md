# PR #101: exploratory IBM Granite technical review — NOT a release attestation

Source commit: `dbe4acb8629c0bfb38a6010d7b824a273ef7992d`

Source digest: `d05236ee7d1e21efccf552b96432a4ed3644353796809ef315a1aff003a8fc9c`

Model: `ibm/granite3.3:2b`, executed via the local Mac Ollama server, without code-modification tools.

Each JSON file preserves the raw model response, prompt hash, source-input hash, model registry digest and completion metadata. Source snapshots and exact prompts are retained in the review runner; the hashes alone do **not** establish a tamper-proof or independently authenticated execution.

- `landing-granite-review.json`: valid JSON and `PASS` restricted to public landing source.
- `qa-granite-review.json`: valid JSON and `PASS` restricted to accessible UI and test source.
- `governance-granite-review.json`: **BLOCKED** because a claimed source quote was not present on the cited line. No governance approval resulted.
- `*-attempt1-granite-review.json`: original malformed and unsupported model results preserved as negative evidence; do not delete them to make the review look green.

The model result is a technical *opinion*, not an independent human approval. These exploratory files are not sourced from a protected GitHub review workflow, so they **must not** be accepted by `trusted-attestor.mjs` or any production gate. The formal model-review workflow and trust plane are only proposed in ADR `docs/operations/solo-maintainer-granite-review.md`.
