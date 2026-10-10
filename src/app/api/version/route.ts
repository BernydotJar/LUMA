import manifest from "@/generated/release-manifest.json";
export const dynamic = "force-dynamic";
/** Immutable provenance only; never expose runtime configuration. */
export function GET() {
  const valid = typeof manifest.gitSha === "string" && /^[a-f0-9]{40}$/.test(manifest.gitSha);
  return Response.json(manifest, {
    status: valid ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}
