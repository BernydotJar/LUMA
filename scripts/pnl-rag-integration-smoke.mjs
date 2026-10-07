import http from "node:http";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const bridgePort = 3153;
const nextPort = 3152;
const token = "luma-pnl-rag-test-token";
let bridgeRequests = 0;

const hit = {
  chunk_id: "chunk-pnl-001",
  source_id: "gdrive_pnl_001",
  drive_file_id: "drive-pnl-001",
  module: "Modulo 2",
  title: "Clase PNL.mp4",
  start_seconds: 293,
  end_seconds: 385,
  start_clock: "00:04:53",
  end_clock: "00:06:25",
  text:
    "El cordon umbilical se menciona en este pasaje del corpus audiovisual.",
  drive_url:
    "https://drive.google.com/file/d/drive-pnl-001/view",
  srt_path: "/private/outputs/clase.srt",
  transcript_path: "/private/outputs/clase.txt",
};

const bridge = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, {
      "content-type": "application/json",
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url !== "/v1/search" || req.method !== "POST") {
    res.writeHead(404).end();
    return;
  }

  bridgeRequests += 1;
  if (req.headers.authorization !== `Bearer ${token}`) {
    res.writeHead(401, {
      "content-type": "application/json",
    });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(
    Buffer.concat(chunks).toString("utf8"),
  );
  const query = String(body.query ?? "").toLowerCase();

  if (query.includes("bridge outage")) {
    res.writeHead(502, {
      "content-type": "application/json",
    });
    res.end(JSON.stringify({ error: "upstream unavailable" }));
    return;
  }

  if (query.includes("irrelevant")) {
    res.writeHead(200, {
      "content-type": "application/json",
    });
    res.end(
      JSON.stringify({
        retrieval: "postgres-fts-pgvector",
        results: [
          {
            ...hit,
            text: "Contenido sobre rapport y calibracion.",
          },
        ],
      }),
    );
    return;
  }

  const results =
    query.includes("cordon") || query.includes("cordón")
      ? [hit]
      : [];

  res.writeHead(200, {
    "content-type": "application/json",
  });
  res.end(
    JSON.stringify({
      retrieval: "postgres-fts-pgvector",
      results,
    }),
  );
});

await new Promise((resolve) =>
  bridge.listen(bridgePort, "127.0.0.1", resolve),
);

const next = spawn(
  "npm",
  [
    "run",
    "dev",
    "--",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(nextPort),
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      LUMA_PNL_RAG_URL: `http://127.0.0.1:${bridgePort}`,
      LUMA_PNL_RAG_TOKEN: token,
      LUMA_PNL_RAG_STRICT: "true",
    },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let nextLog = "";
next.stdout.on("data", (chunk) => {
  nextLog += chunk.toString();
});
next.stderr.on("data", (chunk) => {
  nextLog += chunk.toString();
});

async function cleanup() {
  try {
    process.kill(-next.pid, "SIGTERM");
  } catch {}
  await new Promise((resolve) => bridge.close(resolve));
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${nextPort}/learn`,
      );
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}

    if (next.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  assert.equal(
    ready,
    true,
    `Next did not start.\n${nextLog}`,
  );
  assert.equal(
    next.exitCode,
    null,
    `Next exited unexpectedly.\n${nextLog}`,
  );

  async function tutor(message) {
    const response = await fetch(
      `http://127.0.0.1:${nextPort}/api/tutor`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message }),
      },
    );

    return {
      response,
      body: await response.json(),
    };
  }

  const grounded = await tutor(
    "Explícame el cordón umbilical",
  );
  assert.equal(grounded.response.status, 200);
  assert.equal(grounded.body.trust.status, "GROUNDED");
  assert.equal(
    grounded.body.retrieval.backend,
    "pnl-rag/postgres-fts-pgvector",
  );
  assert.equal(
    grounded.body.evidence.chunkId,
    "chunk-pnl-001",
  );
  assert.equal(
    grounded.body.evidence.startClock,
    "00:04:53",
  );
  assert.equal(
    JSON.stringify(grounded.body).includes(
      "/private/outputs",
    ),
    false,
  );

  const irrelevant = await tutor(
    "Necesito cordón umbilical irrelevant",
  );
  assert.equal(irrelevant.response.status, 200);
  assert.equal(
    irrelevant.body.trust.status,
    "INSUFFICIENT_EVIDENCE",
  );
  assert.equal(irrelevant.body.learningMove, "ASK");

  const beforeHighStakes = bridgeRequests;
  const highStakes = await tutor(
    "¿Una emoción puede enfermar el corazón?",
  );
  assert.equal(highStakes.response.status, 200);
  assert.equal(
    highStakes.body.trust.status,
    "BLOCKED_CLAIM",
  );
  assert.equal(bridgeRequests, beforeHighStakes);
  const highStakesBypassedRetrieval =
    bridgeRequests === beforeHighStakes;

  const outage = await tutor("bridge outage rapport");
  assert.equal(outage.response.status, 503);
  assert.equal(
    outage.body.trust.status,
    "RETRIEVAL_UNAVAILABLE",
  );
  assert.equal(
    JSON.stringify(outage.body).includes("502"),
    false,
  );
  assert.equal(
    JSON.stringify(outage.body).includes("upstream"),
    false,
  );

  console.log(
    JSON.stringify(
      {
        grounded: {
          status: grounded.response.status,
          trust: grounded.body.trust.status,
          backend: grounded.body.retrieval.backend,
          chunkId: grounded.body.evidence.chunkId,
          window:
            `${grounded.body.evidence.startClock} -> ${grounded.body.evidence.endClock}`,
          filesystemLeak: false,
        },
        irrelevant: {
          status: irrelevant.response.status,
          trust: irrelevant.body.trust.status,
        },
        highStakes: {
          status: highStakes.response.status,
          trust: highStakes.body.trust.status,
          retrievalBypassed:
            highStakesBypassedRetrieval,
        },
        outage: {
          status: outage.response.status,
          trust: outage.body.trust.status,
          rawErrorLeak: false,
        },
        bridgeRequests,
      },
      null,
      2,
    ),
  );
} finally {
  await cleanup();
}
