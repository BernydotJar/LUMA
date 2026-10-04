import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe("LUMA product showcase", () => {
  test("marketing experience leads into the real product", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Tu curso no debería decidir/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Construir mi Learning Twin/i })).toBeVisible();
    await page.getByRole("link", { name: /Ver experiencia de cliente/i }).click();
    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByRole("heading", { name: /Buenas noches, Mariana/i })).toBeVisible();
  });

  test("onboarding calibrates a learner and enters the journey", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: /¿Qué quieres ser capaz de hacer/i })).toBeVisible();
    await page.getByRole("button", { name: /Transformar creencias/i }).click();
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.getByRole("button", { name: /Siempre arruino todo/i }).click();
    const diagnosticContinue = page.getByRole("button", { name: /Continuar/i });
    await expect(diagnosticContinue).toBeEnabled();
    await diagnosticContinue.click();
    await expect(page.getByRole("heading", { name: /¿Cuánto tiempo tienes/i })).toBeVisible();
    await page.getByRole("button", { name: /12\s*minutos/i }).click();
    await page.getByRole("button", { name: /Continuar/i }).click();
    await expect(page.getByRole("heading", { name: /Tu Twin inicial está listo/i })).toBeVisible();
    await page.getByRole("button", { name: /Entrar a mi experiencia/i }).click();
    await expect(page).toHaveURL(/\/learn$/);
    const stored = await page.evaluate(() => window.localStorage.getItem("luma-onboarding"));
    expect(stored).toContain('"goal":"beliefs"');
  });

  test("learner can inspect recommendation and ask the grounded tutor", async ({ page }) => {
    await page.goto("/learn");
    await page.getByRole("button", { name: /¿Por qué esto/i }).click();
    await expect(page.getByText(/Dos intentos fallidos seguidos/i)).toBeVisible();
    await page.getByLabel("Pregunta al Tutor LUMA").fill("¿Qué es un P.A.S.?");
    await page.getByRole("button", { name: "Enviar pregunta" }).click();
    await expect(page.getByText(/pensamiento automático saboteador/i)).toBeVisible();
    await expect(page.getByText(/Módulo 3 · sección Comunicación emocional/i)).toBeVisible();
    await expect(page.getByText(/Conexión curricular aprobada/i)).toBeVisible();
  });

  test("tutor blocks unsupported high-stakes course claims", async ({ page }) => {
    await page.goto("/learn");
    await page
      .getByLabel("Pregunta al Tutor LUMA")
      .fill("¿Las emociones enferman un órgano como el riñón?");
    await page.getByRole("button", { name: "Enviar pregunta" }).click();
    await expect(
      page.getByText(/no puede presentarla como un hecho médico verificado/i),
    ).toBeVisible();
    await expect(page.getByText(/Claim bloqueado por política/i)).toBeVisible();
  });

  test("curriculum reflection creates a reviewable artifact without updating learner state", async ({ page }) => {
    await page.goto("/studio/reflections");
    await expect(
      page.getByRole("heading", { name: /El corpus aprende sin reescribir la verdad/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Generar reflexión/i }).click();
    await expect(
      page.getByText(/Borrador generado. Aún no participa en respuestas al learner/i),
    ).toBeVisible();
    await expect(page.getByText(/autoridad de estado: ninguna/i)).toBeVisible();
    await page.getByRole("button", { name: /Aprobar con recibo/i }).click();
    await expect(page.getByText(/Aprobado con recibo/i)).toBeVisible();
    const decision = await page.evaluate(() =>
      window.localStorage.getItem("luma-latest-curriculum-decision"),
    );
    expect(decision).toContain('"learnerTwinUpdated":false');
  });

  test("practice produces a real evidence receipt", async ({ page }) => {
    await page.goto("/learn/session/pas");
    await page.getByRole("button", { name: /Siempre arruino todo/i }).click();
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.getByRole("button", { name: /Vergüenza y miedo/i }).click();
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.getByRole("button", { name: /Esta entrega tuvo dos errores concretos/i }).click();
    await page.getByRole("button", { name: /Registrar evidencia/i }).click();
    await expect(page.getByRole("heading", { name: /Demostraste transferencia/i })).toBeVisible();
    await expect(page.getByText("SIMULATION_COMPLETED")).toBeVisible();
    const event = await page.evaluate(() => window.localStorage.getItem("luma-latest-learning-event"));
    expect(event).toContain("SIMULATION_COMPLETED");
  });

  test("studio lets an instructor assign human intervention", async ({ page }) => {
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: /Learning Studio/i })).toBeVisible();
    const assignButton = page.getByRole("button", { name: "Asignar" }).first();
    await assignButton.click();
    await expect(page.getByRole("button", { name: /Asignado/i }).first()).toBeVisible();
  });

  test("key client-facing views satisfy automated WCAG checks", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Run the full accessibility sweep once on desktop Chromium.");
    for (const path of [
      "/",
      "/learn",
      "/twin",
      "/studio",
      "/studio/reflections",
      "/onboarding",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoA11yViolations(page);
    }
  });
});
