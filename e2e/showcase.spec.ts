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
    await expect(page.getByRole("link", { name: "Ruta", exact: true }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: "Programa", exact: true }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: "LUMA", exact: true }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: /Gemelo|Inteligencia de contenido/i })).toHaveCount(0);
    await expect(page.getByText("Gemelo de aprendizaje", { exact: false })).toHaveCount(0);
  });



  test("legacy Twin route opens the coach intelligence view", async ({ page }) => {
    await page.goto("/twin");
    await expect(page).toHaveURL(/\/studio\/learners\/mariana$/);
    await expect(page.getByRole("heading", { name: /Mariana: estado de aprendizaje con evidencia y confianza/i })).toBeVisible();
  });

  test("coach view exposes proprietary Learning Twin evidence", async ({ page }) => {
    await page.goto("/studio/learners/mariana");
    await expect(page.getByRole("heading", { name: /Mariana: estado de aprendizaje con evidencia y confianza/i })).toBeVisible();
    await expect(page.getByText(/© 2026 LUMA · Modelo de gemelo de aprendizaje y marco de evidencia/i).first()).toBeVisible();
    await expect(page.getByText(/Evidencia del participante/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Objetivos de aprendizaje", exact: true }).last()).toBeVisible();
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
    await expect(page.getByText(/Afirmación bloqueada por política/i)).toBeVisible();
  });

  test("curriculum reflection creates a reviewable artifact without updating learner state", async ({ page }) => {
    await page.goto("/studio/reflections");
    await expect(
      page.getByRole("heading", { name: /Mantén el contenido del programa relevante y confiable/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Generar reflexión/i }).click();
    await expect(
      page.getByText(/Actualización preparada. Revisa el contenido y sus fuentes antes de aprobarla/i),
    ).toBeVisible();
    await expect(page.getByText(/Sin cambios automáticos en el progreso del participante/i)).toBeVisible();
    await page.getByRole("button", { name: /Aprobar con recibo/i }).click();
    await expect(page.getByText(/Actualización aprobada/i)).toBeVisible();
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



  test("superuser can compare roles and persist a visual theme", async ({ page }, testInfo) => {
    await page.goto("/experience");
    await expect(page.getByRole("heading", { name: /Una experiencia de aprendizaje conectada/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ir a mi aprendizaje/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Abrir seguimiento/i }).first()).toBeVisible();

    if (testInfo.project.name === "mobile") {
      await page.getByRole("button", { name: /Cambiar tema\. Tema actual: Seres de Excelencia/i }).click();
    } else {
      await page.getByRole("button", { name: "Usar tema Luz Líquida" }).click();
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    if (testInfo.project.name === "mobile") {
      await page.getByRole("button", { name: /Cambiar tema\. Tema actual: Luz Líquida/i }).click();
    } else {
      await page.getByRole("button", { name: "Usar tema Inteligencia Nocturna" }).click();
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("link", { name: /Ir a mi aprendizaje/i }).click();
    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("experience configuration focuses on learning actions", async ({ page }) => {
    await page.goto("/experience");
    await expect(page.getByRole("heading", { name: /Una experiencia de aprendizaje conectada/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Definir objetivo/i })).toBeVisible();
    await expect(page.getByText(/Grafos de entrega/i)).toHaveCount(0);
    await expect(page.getByText(/Prototipo 01/i)).toHaveCount(0);
  });

  test("adult progress is expressed as capability, transfer and next demonstration", async ({ page }) => {
    await page.goto("/learn");
    await expect(page.getByRole("heading", { name: /Tu progreso se expresa en capacidades demostradas/i })).toBeVisible();
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toContainText(/Capacidad demostrada/i);
    await expect(tabs.nth(1)).toContainText(/Transferencia reciente/i);
    await expect(tabs.nth(2)).toContainText(/Siguiente demostración/i);
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  });

  test("iconography catalog changes material while preserving semantics", async ({ page }) => {
    await page.goto("/iconography");
    await expect(page.getByRole("heading", { name: /Un lenguaje visual claro para cada experiencia/i })).toBeVisible();
    await expect(page.getByText("Práctica", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Progreso", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Claro Luz Líquida", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator('img[src*="/iconography/light/practice.svg"]')).toBeVisible();
  });

  test("premium semantic objects appear in the intended product moments", async ({ page }) => {
    await page.goto("/learn");
    await expect(page.locator('[data-variant="prism"]').first()).toBeVisible();
    await expect(page.locator('[data-variant="orbit"]').first()).toBeVisible();

    await page.goto("/studio");
    await expect(page.locator('[data-variant="strata"]').first()).toBeVisible();
    await expect(page.locator('[data-variant="bridge"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Iniciar sesión/i })).toBeVisible();
  });

  test("Content Intelligence leads with transformation, not the AI operating model", async ({ page }) => {
    await page.goto("/library");
    await expect(
      page.getByRole("heading", { name: /De contenido experto a inteligencia de aprendizaje/i }),
    ).toBeVisible();
    await expect(page.getByText(/La IA propone. El experto publica/i)).toHaveCount(0);
    await expect(page.getByText(/AI-native authoring/i)).toHaveCount(0);
    await expect(page.getByText(/Revisión experta/i)).toBeVisible();
    await expect(page.getByText(/Procedencia preservada/i)).toBeVisible();
  });

  test("studio requires authorized access to participant evidence", async ({ page }) => {
    await page.goto("/studio");
    await expect(page.getByText(/Accede para consultar a tus participantes/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Iniciar sesión/i })).toBeVisible();
  });

  test("key client-facing views satisfy automated WCAG checks", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Run the full accessibility sweep once on desktop Chromium.");
    test.setTimeout(120_000);
    for (const path of [
      "/",
      "/learn",
      "/studio/learners/mariana",
      "/library",
      "/experience",
      "/iconography",
      "/studio",
      "/studio/reflections",
      "/onboarding",
    ]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      if (path === "/") {
        await page.waitForURL(/\/learn$/);
      }
      await page.locator("body").waitFor({ state: "visible" });
      await expectNoA11yViolations(page);
    }
  });
});
