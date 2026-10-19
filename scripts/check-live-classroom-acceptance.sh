#!/bin/sh
# Execute in the repository; pin/install a reviewed Graph Harness revision in CI.
set -eu
BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
: "${GRAPH_HARNESS_ROOT:?Set GRAPH_HARNESS_ROOT to the pinned Graph-harness-sdlc checkout}"
cd "$BASE_DIR"
PYTHONPATH="$GRAPH_HARNESS_ROOT${PYTHONPATH:+:$PYTHONPATH}" python3 -m graph_harness \
  --project graph-harness.live-classroom.project.json \
  --events graph-harness.live-classroom.events.jsonl validate
PYTHONPATH="$GRAPH_HARNESS_ROOT${PYTHONPATH:+:$PYTHONPATH}" python3 -m graph_harness product-acceptance \
  --manifest docs/enterprise/live-classroom-acceptance.json \
  --evidence evidence/live-classroom-acceptance/proofs.json \
  --repo-root . \
  --source-revision "$(git rev-parse HEAD)" \
  ${DEPLOYMENT_ATTESTED_COMMIT:+--production-revision "$DEPLOYMENT_ATTESTED_COMMIT"} \
  --pretty
