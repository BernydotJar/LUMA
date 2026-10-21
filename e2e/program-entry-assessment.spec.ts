import { expect, test } from "@playwright/test";

test.describe("LUMA 070/071 learner entry and contextual class acceptance", () => {
  test("new learner sees a program assessment without extra primary navigation", async ({ page }, testInfo) => {
    await page.goto("/learn");
    const assessment = page.getByTestId("program-entry-assessment");
    await expect(assessment).toBeVisible();
    await expect(assessment.getByRole("heading", { name: /Una ruta que empieza contigo/i })).toBeVisible();
    await expect(assessment.getByText(/No es un examen de certificación/i)).toBeVisible();
    await expect(assessment.getByRole("link", { name: /Define tu objetivo primero/i })).toHaveAttribute("href", "/onboarding");
    expect(await assessment.getByRole("button", { name: /Descubrir dónde empezar/i }).count()).toBe(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "Horizontal page overflow must not hide learner controls").toBeLessThanOrEqual(3);
    await assessment.screenshot({ path: "evidence/learning-ui/assessment-guest-" + testInfo.project.name + ".png" });
  });

  test("onboarding completes then safely requires sign-in for authoritative assessment", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: /Comunicarme con más claridad/i }).click();
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.getByRole("button", { name: /Siempre arruino todo/i }).click();
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.getByRole("button", { name: /12\s*minutos/i }).click();
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.getByRole("button", { name: /Entrar a mi experiencia/i }).click();
    await expect(page).toHaveURL(/\/learn$/);
    const assessment = page.getByTestId("program-entry-assessment");
    await expect(assessment.getByRole("link", { name: /Inicia sesión para guardar tu diagnóstico/i })).toBeVisible();
    await expect(assessment.getByRole("link", { name: /Inicia sesión/i })).toHaveAttribute("href", "/login");
    expect(await page.evaluate(() => localStorage.getItem("luma-latest-learning-event"))).toBeNull();
  });

  test("all class learners can access a contextual assistant next to real instructional content", async ({ page }, testInfo) => {
    await page.goto("/learn/experience/calibracion-observar-antes-de-interpretar");
    await expect(page.getByRole("heading", { name: /Empieza desde donde realmente estás/i })).toBeVisible();
    const tutor = page.locator("#luma");
    await expect(tutor).toBeVisible();
    await expect(tutor).toHaveAttribute("data-context", "class");
    const layout = await tutor.evaluate((element) => {
      const chat = element.querySelector('[aria-live="polite"]')!;
      const style = getComputedStyle(chat);
      return { height: element.getBoundingClientRect().height, chatHeight: chat.getBoundingClientRect().height, chatMinHeight: style.minHeight };
    });
    expect(layout.height, JSON.stringify(layout)).toBeLessThanOrEqual(430);
    await expect(tutor.getByRole("heading", { name: "Pregunta a LUMA" })).toBeVisible();
    await expect(tutor.getByText(/Dudas sobre tu clase y sus fuentes/i)).toBeVisible();
    await expect(tutor.getByRole("button", { name: /Ayúdame a practicar una distinción de esta clase/i })).toBeVisible();
    await expect(tutor.getByRole("textbox", { name: /Pregunta a LUMA/i })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(3);
    await tutor.screenshot({ path: "evidence/learning-ui/tutor-class-" + testInfo.project.name + ".png" });
  });

  test("entry API returns an authentication failure without using simulated identity", async ({ request }) => {
    const response = await request.get("/api/learning/entry-assessment");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("authentication_required");
  });
});
