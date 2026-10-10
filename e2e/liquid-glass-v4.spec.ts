import { expect, test } from "@playwright/test";

const themes = ["se", "light", "dark"] as const;
const contentRoutes = [
  "/learn",
  "/studio/reflections",
  "/studio/learners/mariana",
  "/learn/session/pas",
] as const;

for (const theme of themes) {
  test(`v4 information surfaces remain opaque in ${theme}`, async ({ page }) => {
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem("luma-theme-v1", selectedTheme);
    }, theme);

    for (const route of contentRoutes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const surface = page.locator(".content-surface").first();
      await expect(surface, `No information surface at ${route}`).toBeVisible();
      const material = await surface.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          filter: style.backdropFilter || style.webkitBackdropFilter,
          fill: style.backgroundColor,
        };
      });
      expect(material.filter).toBe("none");
      expect(material.fill).toMatch(/^rgb\(/);
      await expect(page.locator(".glass .glass")).toHaveCount(0);
    }
  });
}

test("v4 Optical Lab material selector changes the actual surface", async ({ page }) => {
  await page.goto("/preview/optical-lab", { waitUntil: "domcontentloaded" });

  const sample = page.locator('[data-material="regular"]');
  await expect(sample).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.locator('[data-material="clear"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Content" }).click();
  await expect(page.locator('[data-material="solid"]')).toBeVisible();
  await expect(page.locator('[data-material="solid"]')).toHaveCSS("backdrop-filter", "none");
  await expect(page.locator('[data-liquid-glass="refractive"]')).toBeVisible();
});

test("v4 navigation exposes the active route and no fake notification button", async ({ page, isMobile }) => {
  await page.goto("/learn", { waitUntil: "domcontentloaded" });
  const navigation = isMobile
    ? page.getByRole("navigation", { name: "Navegación móvil" })
    : page.getByRole("navigation", { name: "Navegación de aprendizaje" });
  await expect(navigation.getByRole("link", { name: "Hoy" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Notificaciones" })).toHaveCount(0);
  if (!isMobile) {
    await expect(page.getByRole("link", { name: "Buscar en biblioteca" })).toHaveAttribute("href", "/library");
  }
});

test("v4 reduced transparency disables backdrop filtering and SVG displacement", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP emulation is Chromium-specific");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
  });
  await page.goto("/preview/optical-lab", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Activa: se omiten filtros y refracción")).toBeVisible();
  await expect(page.locator('[data-liquid-glass="refractive"]')).toHaveAttribute("data-refraction-ready", "false");
  await expect(page.locator('[data-material="regular"]')).toHaveCSS("backdrop-filter", "none");
  await page.goto("/learn", { waitUntil: "domcontentloaded" });
  const mobileOrDesktop = page.locator(".glass").first();
  await expect(mobileOrDesktop).toHaveCSS("backdrop-filter", "none");
});
