import { expect, test } from "@playwright/test";

test("studio navigation selects one most-specific destination", async ({ page }) => {
  for (const [route, label] of [
    ["/studio", "Estudio del entrenador"],
    ["/studio/certificates", "Certificaciones"],
    ["/studio/class-intelligence", "Objetivos de aprendizaje"],
    ["/studio/reflections", "Actualizaciones de contenido"],
  ]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const nav = page.getByRole("navigation", { name: "Navegación del entrenador" });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
  }
});
