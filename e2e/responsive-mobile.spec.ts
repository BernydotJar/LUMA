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

  test("learner navigation retains both certificates and LUMA on mobile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-specific navigation guard.");
    await page.goto("/learn");
    const nav = page.getByRole("navigation", { name: "Navegación móvil" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Hoy", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Ruta", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Programa", exact: true })).toBeVisible();
    await nav.locator("summary").click();
    await expect(nav.getByRole("link", { name: "Certificados", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "LUMA", exact: true })).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(5);

    const layout = await nav.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      itemWidths: [...element.querySelectorAll("a")].map((link) => link.getBoundingClientRect().width),
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    expect(layout.itemWidths.every((width) => width >= 44)).toBe(true);

    await nav.getByRole("link", { name: "Certificados", exact: true }).click();
    await expect(page).toHaveURL(/\/learn\/certificates$/);
    await expect(page.getByRole("navigation", { name: "Navegación móvil" })
      .getByRole("link", { name: "LUMA", exact: true })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: /Para seguir explorando/i })).toBeVisible();

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
