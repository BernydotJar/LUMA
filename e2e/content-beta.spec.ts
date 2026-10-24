import { expect, test } from "@playwright/test";

test("beta content catalog is available to the learner", async ({ page }) => {
  await page.goto("/learn/experiences");
  await expect(page.getByRole("heading", { name: /Tu programa, convertido en práctica/i })).toBeVisible();
  // Next's App Router can stage a hidden copy during hydration. Require one
  // *visible* catalog card per title; genuinely duplicated visible cards fail.
  const titles = page.locator('section[aria-label="Experiencias disponibles"] h3:visible');
  for (const title of [
    "Congruencia: tres canales, un mensaje",
    "Calibración: observar antes de interpretar",
    "Rapport: crear sintonía con respeto",
    "P.A.S.: detectar y reformular",
  ]) {
    await expect(titles.filter({ hasText: title }), `Only one visible card may show ${title}`).toHaveCount(1);
  }
});

test("a reflection creates a practice receipt", async ({ page }) => {
  await page.goto("/learn/experience/calibracion-observar-antes-de-interpretar");
  await page.getByLabel("Tu reflexión").fill(
    "Vi una pausa larga y un cambio de tono. Eso fue observable; asumir incomodidad fue mi interpretación.",
  );
  await page.getByRole("button", { name: /Registrar práctica/i }).click();
  await expect(page.getByRole("heading", { name: /Ya dejaste una señal útil/i })).toBeVisible();
  await expect(page.getByText("Auto-reportada")).toBeVisible();
  await expect(page.getByText(/Vista previa registrada en esta sesión/i)).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("luma-latest-learning-event"))).toBeNull();
});
