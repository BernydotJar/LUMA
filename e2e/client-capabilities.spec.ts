import { expect, test } from "@playwright/test";

test.describe("V2 client discovery capabilities", () => {
  test("content intelligence is visible in the library without leaking internal locators", async ({ page }) => {
    await page.goto("/library");
    await expect(
      page.getByRole("heading", {
        name: /Pregunta al conocimiento acumulado/i,
      }),
    ).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("srtPath");
    expect(body).not.toContain("transcriptPath");
  });

  test("commerce access requires authentication", async ({ request }) => {
    const response = await request.get("/api/commerce/access");
    expect(response.status()).toBe(401);
  });

  test("content intelligence search requires authentication", async ({ request }) => {
    const response = await request.post(
      "/api/content-intelligence/search",
      { data: { query: "P.A.S." } },
    );
    expect(response.status()).toBe(401);
  });

  test("learner live schedule requires authentication", async ({ request }) => {
    const response = await request.get("/api/programs/my-schedule");
    expect(response.status()).toBe(401);
  });

  test("coach interventions require a coach identity", async ({ request }) => {
    const response = await request.get("/api/coach/interventions");
    expect(response.status()).toBe(401);
  });

  test("commerce mappings fail closed without an admin identity", async ({ request }) => {
    const response = await request.post(
      "/api/commerce/admin/mappings",
      {
        data: {
          provider: "hotmart",
          externalProductId: "external",
          tenantId: "tenant",
          productId: "product",
          programId: "program",
        },
      },
    );
    expect(response.status()).toBe(401);
  });
});
