import http from "node:http";

const port = Number(process.env.PNL_MOCK_PORT || "3153");
const token =
  process.env.PNL_MOCK_TOKEN || "luma-pnl-rag-test-token";

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

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url !== "/v1/search" || req.method !== "POST") {
    res.writeHead(404).end();
    return;
  }

  if (req.headers.authorization !== `Bearer ${token}`) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(
    Buffer.concat(chunks).toString("utf8"),
  );
  const query = String(body.query ?? "").toLowerCase();

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

server.listen(port, "127.0.0.1", () => {
  console.log(
    `mock-pnl-rag listening on 127.0.0.1:${port}`,
  );
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () =>
    server.close(() => process.exit(0)),
  );
}
