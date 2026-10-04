import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe("LUMA product showcase", () => {
  test("showcase root enters the learner product immediately", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByRole("heading", { name: /Hoy llevas lo que sabes a la práctica/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Continuar · 12 min/i })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: /Tu punto de partida está listo/i })).toBeVisible();
    await page.getByRole("button", { name: /Entrar a mi experiencia/i }).click();
    await expect(page).toHaveURL(/\/learn$/);
    const stored = await page.evaluate(() => window.localStorage.getItem("luma-onboarding"));
    expect(stored).toContain('"goal":"beliefs"');
  });



  test("coachee navigation keeps internal intelligence out of the learning surface", async ({ page }) => {
    await page.goto("/learn");
    await expect(page.getByRole("link", { name: "Hoy", exact: true }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: "Journey", exact: true }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: "Práctica", exact: true }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: "LUMA", exact: true }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: /Twin|Content Intelligence/i })).toHaveCount(0);
    await expect(page.getByText("Learning Twin", { exact: false })).toHaveCount(0);
  });



  test("legacy Twin route opens the coach intelligence view", async ({ page }) => {
    await page.goto("/twin");
    await expect(page).toHaveURL(/\/studio\/learners\/mariana$/);
    await expect(page.getByRole("heading", { name: /Mariana: estado de aprendizaje con evidencia y confianza/i })).toBeVisible();
  });

  test("coach view exposes proprietary Learning Twin evidence", async ({ page }) => {
    await page.goto("/studio/learners/mariana");
    await expect(page.getByRole("heading", { name: /Mariana: estado de aprendizaje con evidencia y confianza/i })).toBeVisible();
    await expect(page.getByText(/© 2026 LUMA · Learning Twin model & evidence framework/i)).toBeVisible();
    await expect(page.getByText(/Evidencia del coachee/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Learning Twin", exact: true }).last()).toBeVisible();
  });

  test("learner can inspect recommendation and ask the grounded tutor", async ({ page }) => {
    await page.goto("/learn");
    await page.getByRole("button", { name: /¿Por qué esta práctica/i }).click();
    await expect(page.getByText(/Lo que LUMA observó/i)).toBeVisible();
    await page.getByRole("textbox", { name: "Pregunta a LUMA" }).fill("¿Qué es un P.A.S.?");
    await page.getByRole("button", { name: "Enviar pregunta" }).click();
    await expect(page.getByText(/pensamiento automático saboteador/i)).toBeVisible();
    await expect(page.getByText(/Módulo 3 · sección Comunicación emocional/i)).toBeVisible();
    await expect(page.getByText(/Conexión curricular aprobada/i)).toBeVisible();
  });

  test("tutor blocks unsupported high-stakes course claims", async ({ page }) => {
    await page.goto("/learn");
    await page
      .getByRole("textbox", { name: "Pregunta a LUMA" })
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
      page.getByRole("heading", { name: /El corpus aprende con trazabilidad y revisión/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Generar reflexión/i }).click();
    await expect(
      page.getByText(/Borrador generado. Estado: revisión humana antes de participar en respuestas al coachee/i),
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
    await expect(page.getByRole("heading", { name: /Coach Studio/i })).toBeVisible();
    const assignButton = page.getByRole("button", { name: "Asignar" }).first();
    await assignButton.click();
    await expect(page.getByRole("button", { name: /Asignado/i }).first()).toBeVisible();
  });

  test("key client-facing views satisfy automated WCAG checks", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Run the full accessibility sweep once on desktop Chromium.");
    for (const path of [
      "/",
      "/learn",
      "/studio/learners/mariana",
      "/library",
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
