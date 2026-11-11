import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Seres de Excelencia public landing", () => {
  test("presents a simple, honest public journey", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Seres de Excelencia/);
    const officialLogo = page
      .getByRole("link", { name: "LUMA y Seres de Excelencia, inicio" })
      .getByRole("img", { name: "Seres de Excelencia" });
    await expect(officialLogo).toBeVisible();
    await expect(officialLogo).toHaveAttribute("src", /seres-de-excelencia/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/El primer paso es conocerte/);
    await expect(page.getByRole("heading", { name: "Biodescodificación" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Biocodificación" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Consciencia" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ingresar a LUMA" })).toHaveAttribute("href", "/login");
    await expect(page.getByRole("navigation", { name: "Enlaces del pie de página" }).getByRole("link", { name: "Explorar" })).toHaveAttribute("href", "/learn");
    await expect(page.getByText(/no sustituye la atención sanitaria/)).toBeVisible();
    await page.getByRole("link", { name: "Conocer el enfoque" }).click();
    await expect(page).toHaveURL(/#enfoque$/);
  });

  test("the primary CTA opens the existing Google sign-in screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Ingresar a LUMA" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /Continuar con Google/i })).toBeVisible();
  });

  test("has no critical or serious WCAG A/AA findings", async ({ page }) => {
    await page.goto("/");
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const violations = report.violations.filter(({ impact }) =>
      impact === "critical" || impact === "serious",
    );
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test("keyboard focus has two contrasting colors on dark and light backgrounds", async ({ page }) => {
    await page.goto("/");
    for (const link of [
      page.getByRole("link", { name: "Ingresar a LUMA" }),
      page.getByRole("navigation", { name: "Enlaces del pie de página" })
        .getByRole("link", { name: "Explorar" }),
    ]) {
      await link.focus();
      await expect(link).toBeFocused();
      const style = await link.evaluate(el => {
        const css = getComputedStyle(el);
        return { outline: css.outlineColor, width: css.outlineWidth, shadow: css.boxShadow };
      });
      expect(style.outline).toBe("rgb(101, 30, 68)");
      expect(style.width).toBe("3px");
      // The primary CTA animates box-shadow for 170ms: inspect the settled
      // keyboard focus state rather than an intermediate translucent frame.
      await expect
        .poll(async () => link.evaluate(el => getComputedStyle(el).boxShadow), {
          timeout: 3000,
        })
        .toMatch(/rgba?\(255,\s*255,\s*255(?:,\s*1)?\)\s+0px\s+0px\s+0px\s+6px/);
    }
  });

  test("captures official branding for visual audit", async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === "mobile";
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("img", { name: "Seres de Excelencia" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; });
    const prefix = mobile ? "mobile" : "desktop";
    await page.screenshot({ path: testInfo.outputPath(prefix + "-full.jpg"),
      type: "jpeg", quality: 83, fullPage: true, animations: "disabled" });
    await page.screenshot({ path: testInfo.outputPath(prefix + "-hero.jpg"),
      type: "jpeg", quality: 83, animations: "disabled" });
  });

  test("fits mobile and desktop viewports without horizontal overflow", async ({ page }, testInfo) => {
    await page.goto("/");
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      imageLoaded: Boolean(document.querySelector('img[src*="seres-violet-hero"]')?.getAttribute("src")),
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 2);
    expect(dimensions.imageLoaded).toBe(true);
    await expect(page.getByRole("link", { name: /^Ingresar/ }).first()).toBeVisible();
    if (testInfo.project.name === "mobile") {
      await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeHidden();
      await expect(page.getByRole("link", { name: "Conocer el enfoque" })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
    }
  });
});
