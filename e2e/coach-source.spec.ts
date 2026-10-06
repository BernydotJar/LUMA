import { expect, test } from "@playwright/test";

test.describe("Coach authoritative learner source", () => {
  test("coach API requires authentication", async ({ request }) => {
    const response = await request.get("/api/coach/learners");
    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "authentication_required" });
  });

  test("persistent learner detail never falls back to showcase data without coach authorization", async ({ page }) => {
    await page.goto("/studio/learners/not-a-showcase-learner");
    await expect(page.getByText("Vista protegida del entrenador")).toBeVisible();
    await expect(page.getByText(/requiere un token Firebase con claim/i)).toBeVisible();
    await expect(page.getByText(/Mariana: estado de aprendizaje/i)).toHaveCount(0);
  });

  test("existing showcase coach experience remains available", async ({ page }) => {
    await page.goto("/studio/learners/mariana");
    await expect(page.getByRole("heading", { name: /Mariana: estado de aprendizaje/i })).toBeVisible();
    await expect(page.getByText(/Modelo de gemelo de aprendizaje y marco de evidencia/i)).toBeVisible();
  });
});
