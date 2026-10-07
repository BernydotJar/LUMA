import { expect, test } from "@playwright/test";

test.describe("AI-native class entry", () => {
  test("P.A.S. diagnostic records routing evidence without claiming mastery", async ({ page }) => {
    await page.goto("/learn/experience/pas-detectar-y-reformular");

    await expect(
      page.getByRole("heading", { name: /Empieza desde donde realmente estás/i }),
    ).toBeVisible();
    await expect(page.getByText(/Esta señal no certifica dominio/i)).toBeVisible();

    await page
      .getByRole("button", { name: /La directora señaló dos errores de la propuesta/i })
      .click();
    await page.getByRole("button", { name: "Comprobar", exact: true }).click();

    await expect(
      page.getByText(/Conviene reforzar una distinción antes de practicar/i),
    ).toBeVisible();

    const firstReceipt = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("luma-latest-learning-event") ?? "{}"),
    );
    expect(firstReceipt).toMatchObject({
      type: "CLASS_DIAGNOSTIC_COMPLETED",
      classId: "pas-detectar-y-reformular",
      capabilityId: "pas",
      correct: false,
      recommendedRoute: "review",
      evidenceCategory: "observed",
      twinAuthority: "none",
    });

    await page.getByRole("button", { name: /Intentar otra vez/i }).click();
    await page
      .getByRole("button", { name: /Siempre arruino todo/i })
      .click();
    await page.getByRole("button", { name: "Comprobar", exact: true }).click();

    await expect(page.getByText(/Puedes acelerar esta parte/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Ir a la simulación/i })).toBeVisible();

    const secondReceipt = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("luma-latest-learning-event") ?? "{}"),
    );
    expect(secondReceipt).toMatchObject({
      type: "CLASS_DIAGNOSTIC_COMPLETED",
      classId: "pas-detectar-y-reformular",
      capabilityId: "pas",
      correct: true,
      recommendedRoute: "simulation",
      evidenceCategory: "observed",
      twinAuthority: "none",
    });
  });

  test("every published experience exposes a learning contract", async ({ page }) => {
    const slugs = [
      "congruencia-tres-canales",
      "calibracion-observar-antes-de-interpretar",
      "rapport-sintonia-con-respeto",
      "pas-detectar-y-reformular",
      "niveles-logicos-donde-intervenir",
      "creencias-evidencia-e-interpretacion",
      "valores-identidad-y-eleccion",
    ];

    for (const slug of slugs) {
      await page.goto(`/learn/experience/${slug}`);
      await expect(
        page.getByRole("heading", { name: /Empieza desde donde realmente estás/i }),
      ).toBeVisible();
      await expect(page.getByText(/Cómo lo vas a demostrar/i)).toBeVisible();
    }
  });

  test("P.A.S. simulation emits rubric-based scored evidence", async ({ page }) => {
    await page.goto("/learn/session/pas");

    await page.getByRole("button", { name: /Siempre arruino todo/i }).click();
    await page.getByRole("button", { name: /^Continuar/i }).click();
    await page.getByRole("button", { name: /Vergüenza y miedo a perder credibilidad/i }).click();
    await page.getByRole("button", { name: /^Continuar/i }).click();
    await page.getByRole("button", { name: /Esta entrega tuvo dos errores concretos/i }).click();
    await page.getByRole("button", { name: /Registrar evidencia/i }).click();

    await expect(page.getByRole("heading", { name: /Demostraste transferencia/i })).toBeVisible();
    await expect(page.getByText("pas-v1", { exact: true })).toBeVisible();

    const receipt = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("luma-latest-learning-event") ?? "{}"),
    );
    expect(receipt).toMatchObject({
      type: "SIMULATION_COMPLETED",
      conceptId: "pas",
      rubricId: "pas-v1",
      evidenceCategory: "scored",
      twinAuthority: "eligible",
      correctCount: 3,
    });
    expect(receipt.criteria).toHaveLength(3);
    expect(receipt.criteria.every((criterion: { passed?: boolean }) => criterion.passed)).toBe(true);
  });

  test("coach can inspect the class intelligence operating model", async ({ page }) => {
    await page.goto("/studio/class-intelligence");
    await expect(page.getByRole("heading", { name: /La clase también aprende/i })).toBeVisible();
    await expect(page.getByText(/Una fuente nueva crea una propuesta, no una mutación/i)).toBeVisible();
    await expect(page.getByText(/Actualización silenciosa/i)).toBeVisible();

    const geometry = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBe(geometry.width);
  });

});
