import { expect, test } from "@playwright/test";

test("institution publication preflight is unavailable without an explicit server flag", async ({ request }) => {
  const result = await request.get("/api/platform/institutions/test-organization/publication-preflight");
  expect(result.status()).toBe(503);
  expect(await result.json()).toEqual({ error: "feature_unavailable" });
  expect(result.headers()["cache-control"]).toContain("no-store");
});

test("institution publication preview exposes no mutation endpoint", async ({ request }) => {
  const endpoint = "/api/platform/institutions/test-organization/publication-preflight";
  for (const method of ["POST", "PATCH", "PUT", "DELETE"] as const) {
    const result = await request.fetch(endpoint, { method });
    expect(result.status()).toBe(405);
  }
});
