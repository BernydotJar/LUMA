import { expect, test, type Page } from "@playwright/test";

async function completeOnboarding(
  page: Page,
  options: {
    goal: "emotions" | "beliefs" | "communication";
    diagnostic: "a" | "b" | "c";
    minutes: 8 | 12 | 20 | 35;
  },
) {
  await page.goto("/onboarding");

  const goalLabels = {
    emotions: /Gestionar mejor mis emociones/i,
    beliefs: /Transformar creencias que me frenan/i,
    communication: /Comunicarme con más claridad/i,
  };
  await page.getByRole("button", { name: goalLabels[options.goal] }).click();
  await page.getByRole("button", { name: /Continuar/i }).click();

  const diagnosticLabels = {
    a: /La observación se refiere a esta entrega/i,
    b: /Siempre arruino todo/i,
    c: /Siento incomodidad/i,
  };
  await page.getByRole("button", { name: diagnosticLabels[options.diagnostic] }).click();
  await page.getByRole("button", { name: /Continuar/i }).click();

  await page.getByRole("button", { name: new RegExp(`${options.minutes}\\s*minutos`, "i") }).click();
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /Entrar a mi experiencia/i }).click();
  await expect(page).toHaveURL(/\/learn$/);
  await expect(page.locator("#next-action-title")).toBeVisible();
}

test.describe("LUMA adaptive learning loop", () => {
  test("canonical learner states receive materially different next actions", async ({ page }) => {
    await completeOnboarding(page, {
      goal: "emotions",
      diagnostic: "b",
      minutes: 8,
    });

    await expect(page.getByText("Gestionar mejor mis emociones", { exact: true }).first()).toBeVisible();
    // The editorial home removed the redundant time-budget sentence. Verify the
    // persisted input used by the adaptive planner, not obsolete presentation copy.
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("luma-onboarding") ?? "{}").minutes)).toBe(8);
    const learnerAAction = (await page.locator("#next-action-title").textContent())?.trim();

    await completeOnboarding(page, {
      goal: "communication",
      diagnostic: "a",
      minutes: 35,
    });

    await expect(page.getByText("Comunicarme con más claridad", { exact: true }).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("luma-onboarding") ?? "{}").minutes)).toBe(35);
    const learnerBAction = (await page.locator("#next-action-title").textContent())?.trim();

    await completeOnboarding(page, {
      goal: "beliefs",
      diagnostic: "a",
      minutes: 20,
    });

    await expect(page.getByText("Transformar creencias que me frenan", { exact: true }).first()).toBeVisible();
    const learnerCAction = (await page.locator("#next-action-title").textContent())?.trim();

    expect(learnerAAction).toBeTruthy();
    expect(learnerBAction).toBeTruthy();
    expect(learnerCAction).toBeTruthy();
    expect(learnerBAction).toContain("congruencia");
    expect(learnerCAction).toContain("P.A.S.");
    expect(learnerAAction).not.toBe(learnerBAction);
    expect(learnerBAction).not.toBe(learnerCAction);
    expect(learnerAAction).not.toBe(learnerCAction);
  });

  test("successful practice evidence changes the next best action", async ({ page }) => {
    await completeOnboarding(page, {
      goal: "emotions",
      diagnostic: "b",
      minutes: 12,
    });

    const before = (await page.locator("#next-action-title").textContent())?.trim();
    await page.getByRole("link", { name: /Continuar · 12 min/i }).click();
    await expect(page).toHaveURL(/\/learn\/session\/pas$/);

    await page.getByRole("button", { name: /Siempre arruino todo/i }).click();
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.getByRole("button", { name: /Vergüenza y miedo/i }).click();
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.getByRole("button", { name: /Esta entrega tuvo dos errores concretos/i }).click();
    await page.getByRole("button", { name: /Registrar evidencia/i }).click();

    await expect(page.getByRole("heading", { name: /Demostraste transferencia/i })).toBeVisible();
    await page.getByRole("link", { name: /Volver a mi ruta/i }).click();

    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByTestId("route-changed")).toBeVisible();
    const after = (await page.locator("#next-action-title").textContent())?.trim();

    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);

    const event = await page.evaluate(() => window.localStorage.getItem("luma-latest-learning-event"));
    expect(event).toContain('"correctCount":3');
  });
});
