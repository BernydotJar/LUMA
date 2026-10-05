import { expect, test } from "@playwright/test";

test.describe("responsive mobile product", () => {
  test("mobile learner header does not overlap and navigation remains usable", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-specific geometry check.");
    await page.goto("/learn");
    await page.waitForLoadState("networkidle");

    const geometry = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      };
      return {
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        title: box('[class*="pageTitle"]'),
        actions: box('[class*="topbarActions"]'),
      };
    });

    expect(geometry.scrollWidth).toBe(geometry.width);
    expect(geometry.title).not.toBeNull();
    expect(geometry.actions).not.toBeNull();
    expect(geometry.title!.right).toBeLessThan(geometry.actions!.left);
    await expect(page.getByRole("navigation", { name: "Navegación móvil" })).toBeVisible();
  });

  test("all seven program modules are selectable on mobile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-specific program flow check.");
    await page.goto("/learn/experiences");
    await expect(page.getByRole("heading", { name: /Siete módulos/i })).toBeVisible();

    for (let number = 1; number <= 7; number += 1) {
      await expect(page.getByRole("button", { name: `Ir al módulo ${number}` })).toBeVisible();
    }

    await page.getByRole("button", { name: "Ir al módulo 5" }).click();
    await expect(page.getByRole("heading", { name: "Encuentro contigo mismo", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ir al módulo 7" }).click();
    await expect(page.getByRole("heading", { name: "Módulo 7", exact: true })).toBeVisible();
  });

  test("practice suggestions use horizontal snap rather than stacked dashboard cards", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-specific interaction check.");
    await page.goto("/learn");
    await expect(page.getByRole("heading", { name: /Una idea se vuelve útil cuando la pruebas/i })).toBeVisible();

    const behavior = await page.evaluate(() => {
      const strip = document.querySelector('[class*="fieldNotes"]');
      if (!strip) return null;
      const style = getComputedStyle(strip);
      return {
        display: style.display,
        overflowX: style.overflowX,
        snap: style.scrollSnapType,
        scrollable: strip.scrollWidth > strip.clientWidth,
      };
    });

    expect(behavior).not.toBeNull();
    expect(behavior!.display).toBe("flex");
    expect(behavior!.overflowX).toBe("auto");
    expect(behavior!.snap).toContain("x");
    expect(behavior!.scrollable).toBe(true);
  });
});
