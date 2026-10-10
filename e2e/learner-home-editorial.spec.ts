import { expect, test } from "@playwright/test";

test.describe("learner-first editorial CX", () => {
  test("the first viewport has exactly one primary practice action", async ({ page }, testInfo) => {
    await page.goto("/learn");
    await expect(page.getByRole("heading", { name: /Aprender se nota en lo que haces/i })).toBeVisible();
    const hero = page.locator('section[data-variant="hero"]');
    await expect(hero).toHaveCount(1);
    const startLink = hero.getByRole("link", { name: /Empezar práctica/i });
    await expect(startLink).toHaveCount(1);
    const metrics = await page.evaluate(() => {
      const action = document.querySelector('section[data-variant="hero"] a[href]')?.getBoundingClientRect();
      const header = document.querySelector('section[data-variant="hero"]')?.getBoundingClientRect();
      return {
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        pageHeight: document.body.scrollHeight,
        actionBottom: action?.bottom ?? 99999,
        headerTop: header?.top ?? 99999,
      };
    });
    expect(metrics.documentWidth).toBe(metrics.viewportWidth);
    expect(metrics.headerTop).toBeLessThan(metrics.viewportHeight);
    expect(metrics.actionBottom).toBeLessThan(testInfo.project.name === "mobile" ? 980 : metrics.viewportHeight);
    expect(metrics.pageHeight).toBeLessThan(testInfo.project.name === "mobile" ? 5500 : 3700);
    await expect(page.getByRole("link", { name: /Explora tu programa/i })).toHaveAttribute("href", "/learn/experiences");
    await expect(page.getByRole("link", { name: /Consulta tu ruta/i })).toHaveAttribute("href", "/learn#journey");
  });

  test("learners see actual navigation rather than internal controls", async ({ page }) => {
    await page.goto("/learn");
    await expect(page.getByRole("link", { name: /Superusuario/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Entrenador/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Cambiar tema/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Notificaciones/i })).toHaveCount(0);
    await page.getByRole("button", { name: /Cambiar tema/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("the full learning path is available without filling the default screen", async ({ page }) => {
    await page.goto("/learn");
    const disclosure = page.locator("#journey details");
    await expect(disclosure).not.toHaveAttribute("open", "");
    await disclosure.locator("summary").click();
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(page.getByRole("link", { name: /Definir mi objetivo/i })).toBeVisible();
    await disclosure.locator("summary").click();
    await expect(disclosure).not.toHaveAttribute("open", "");
    await expect(page.getByRole("textbox", { name: "Pregunta a LUMA" })).toBeVisible();
  });
});
