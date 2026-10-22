import { expect, test } from "@playwright/test";

test.describe("LUMA P0 institutional assessment publisher", () => {
  test("studio exposes a compact administrative flow without leaking academic data", async ({ page }) => {
    await page.goto("/studio/assessments");
    const console = page.getByTestId("assessment-publication-console");
    await expect(console).toBeVisible();
    await expect(console.getByRole("heading", { name: "Un diagnóstico para cada programa." })).toBeVisible();
    await expect(console.getByRole("heading", { name: "Preparar versión curricular" })).toBeVisible();
    await expect(console.getByRole("heading", { name: "Revisar documentación y aprobar" })).toBeVisible();
    await expect(console.getByRole("heading", { name: "Publicar o retirar sin perder el historial" })).toBeVisible();
    await expect(console.getByRole("button", { name: /Publicar versión revisada/i })).toBeDisabled();
    await expect(console.getByRole("button", { name: /Retirar versión/i })).toBeDisabled();
    await expect(console.getByRole("button", { name: /Preparar currículo/i })).toBeDisabled();

    await console.getByLabel("Identificador de academia").fill("qa-tenant");
    await console.getByLabel("Identificador de programa").fill("pnl-practitioner");
    await console.getByRole("button", { name: /Consultar estado autorizado/i }).click();
    await expect(console.getByRole("alert")).toContainText("Inicia sesión");
    await expect(console.getByRole("button", { name: /Publicar versión revisada/i })).toBeDisabled();
    const difference = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(difference).toBeLessThanOrEqual(3);
  });

  test("API denies public publisher access without enabling the explicit feature flag", async ({ request }) => {
    const response = await request.get("/api/platform/institutions/qa-tenant/programs/pnl-practitioner/assessment-publication");
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("feature_unavailable");
  });
});
