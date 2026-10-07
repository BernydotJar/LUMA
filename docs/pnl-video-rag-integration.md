# LUMA ↔ PNL Video RAG integration

## Purpose

LUMA retrieves approved audiovisual evidence from the local PNL Video RAG corpus without exposing PostgreSQL, SQLite fallback files, cache paths, OAuth material, or the original private Drive media to the browser.

## Runtime topology

```text
Learner browser
    ↓
LUMA /api/tutor (server-side)
    ↓
private authenticated PNL RAG bridge
    ↓
PostgreSQL + pgvector-ready schema + Spanish FTS
    ↓
Google Drive provenance + local timestamp

SQLite remains an offline/development fallback and ingest checkpoint.
```

The bridge is provided by the additive `pnl-rag serve` command in `Download_Subtitles_python`.

## LUMA environment

```bash
LUMA_PNL_RAG_URL=https://<private-rag-endpoint>
LUMA_PNL_RAG_TOKEN=<same bearer secret used by pnl-rag serve>
LUMA_PNL_RAG_STRICT=true
```

When `LUMA_PNL_RAG_URL` is configured, strict mode defaults to true. In strict mode:

- retrieval is attempted before the deterministic showcase fallback;
- no hits return `No encontré evidencia suficiente en el corpus procesado.`;
- bridge failure is surfaced as retrieval unavailable;
- LUMA does not silently answer from model memory.

When no bridge URL exists, the current deterministic showcase tutor remains available for the pre-production demo.

## Security boundary

- LUMA calls the bridge server-to-server.
- The bearer token is never sent to the learner browser.
- The bridge refuses non-loopback binding unless a token is configured.
- The original Drive file is never modified.
- Search responses carry Drive provenance and timestamps; LUMA does not invent Drive timecode deep-links.

## Deployment note

Firebase/App Hosting cannot directly read the Mac filesystem or the local PostgreSQL socket. A deployed LUMA instance therefore needs a reachable private endpoint for the bridge, for example an authenticated private tunnel. The approved demo topology keeps PostgreSQL on the Mac behind the bridge; SQLite remains fallback only.

Do not make the bridge broadly public. If a tunnel is used, combine tunnel access control with the bridge bearer token.

## Release dependency

The bridge can be integrated and tested before the corpus is fully processed, but production tutor traffic should not be switched to the corpus until the representative MLX Large V3 Turbo pilot is explicitly `RELEASE_READY`.


## Local PostgreSQL configuration

```bash
export PNL_RAG_DATABASE_URL='postgresql://...'
pnl-rag postgres-migrate
pnl-rag postgres-sync --output-root "$PNL_RAG_OUTPUT_ROOT"
pnl-rag stats --output-root "$PNL_RAG_OUTPUT_ROOT"
```

The migration uses the isolated `luma_pnl` schema and enables pgvector. Retrieval is
currently PostgreSQL Spanish full-text search; the vector column remains nullable until
a real embedding provider is selected. No synthetic vectors are generated for the demo.
