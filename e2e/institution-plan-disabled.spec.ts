import { expect, test } from "@playwright/test";

const route = "/api/platform/institutions/example-tenant/publication-plan";

test("publication plan GET/POST/PATCH are disabled without a server-only flag", async ({ request }) => {
  for (const method of ["GET", "POST", "PATCH"] as const) {
    const response = await request.fetch(route, { method });
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({ error: "feature_unavailable" });
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});

test("plan endpoint has no PUT/DELETE publication bypass", async ({ request }) => {
  for (const method of ["PUT", "DELETE"] as const) {
    const response = await request.fetch(route, { method });
    expect(response.status()).toBe(405);
  }
});
