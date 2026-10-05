import { expect, test } from "@playwright/test";

test("beta content catalog is available to the learner", async ({ page }) => {
  await page.goto("/learn/experiences");
  await expect(page.getByRole("heading", { name: /Tu programa, convertido en práctica/i })).toBeVisible();
  await expect(page.getByText("Congruencia: tres canales, un mensaje")).toBeVisible();
  await expect(page.getByText("Calibración: observar antes de interpretar")).toBeVisible();
  await expect(page.getByText("Rapport: crear sintonía con respeto")).toBeVisible();
  await expect(page.getByText("P.A.S.: detectar y reformular")).toBeVisible();
});

test("a reflection creates a practice receipt", async ({ page }) => {
  await page.goto("/learn/experience/calibracion-observar-antes-de-interpretar");
  await page.getByLabel("Tu reflexión").fill(
    "Vi una pausa larga y un cambio de tono. Eso fue observable; asumir incomodidad fue mi interpretación.",
  );
  await page.getByRole("button", { name: /Registrar práctica/i }).click();
  await expect(page.getByRole("heading", { name: /Ya dejaste una señal útil/i })).toBeVisible();
  const event = await page.evaluate(() => window.localStorage.getItem("luma-latest-learning-event"));
  expect(event).toContain("PRACTICE_REFLECTION_RECORDED");
});
