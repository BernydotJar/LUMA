import { expect, test } from "@playwright/test";

test("studio navigation selects one most-specific destination", async ({ page }, testInfo) => {
  for (const [route, label] of [
    ["/studio", "Estudio del entrenador"],
    ["/studio/certificates", "Certificaciones"],
    ["/studio/class-intelligence", "Objetivos de aprendizaje"],
    ["/studio/reflections", "Actualizaciones de contenido"],
  ]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const mobile = testInfo.project.name === "mobile";
    const nav = page.getByRole("navigation", { name: mobile ? "Navegación móvil" : "Navegación del entrenador" });
    if (mobile && route === "/studio/reflections") {
      await nav.locator("summary").click();
    }
    await expect(nav).toBeVisible();
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
  }
});
