import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("luma-theme-v1", "light");
  });
});

test("Liquid Light renders bounded refraction without nested glass", async ({ page }) => {
  await page.goto("/experience", { waitUntil: "networkidle" });

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  const preview = page.locator('[data-liquid-glass="refractive"]');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("data-refraction-ready", "true", { timeout: 5000 });

  const optics = await preview.evaluate((element) => {
    const filtered = Array.from(element.querySelectorAll<HTMLElement>("*"))
      .map((node) => getComputedStyle(node).filter)
      .find((value) => value.includes("url("));
    return {
      filter: filtered ?? "none",
      filterCount: element.querySelectorAll("filter").length,
    };
  });

  expect(optics.filter).toContain("url(");
  expect(optics.filterCount).toBe(1);
  await expect(page.locator(".glass .glass")).toHaveCount(0);

  const glassMaterial = await page.locator(".glass").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return style.backdropFilter;
  });
  expect(glassMaterial).toContain("blur(16px)");
  expect(glassMaterial).toContain("saturate(1.08)");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});


test("Dense content surfaces stay out of the backdrop-filter layer", async ({ page }) => {
  for (const route of ["/learn", "/studio", "/library"]) {
    await page.goto(route, { waitUntil: "networkidle" });

    const material = await page.locator(".content-surface").first().evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backdropFilter: style.backdropFilter,
        backgroundColor: style.backgroundColor,
      };
    });

    expect(material.backdropFilter).toBe("none");
    expect(material.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    await expect(page.locator(".glass .glass")).toHaveCount(0);
  }
});


test("appearance previews keep brands and labels unobstructed", async ({ page }) => {
  await page.goto("/experience", { waitUntil: "domcontentloaded" });
  const cards = page.locator('button[aria-pressed][class*="themeCard"]');
  await expect(cards).toHaveCount(3);
  const metrics = await page.evaluate(() => {
    const previews = Array.from(document.querySelectorAll<HTMLElement>('[data-theme-preview]'));
    return previews.map((preview) => {
      const brand = preview.querySelector<HTMLElement>('img, [class*="previewTitle"], [class*="sceneWord"]');
      const lens = preview.querySelector<HTMLElement>('[class*="lens"]:not([class*="Clip"]):not([class*="Tint"]):not([class*="Glint"])');
      const brandRect = brand?.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const lensRect = lens?.getBoundingClientRect();
      const intersectsLens = Boolean(brandRect && lensRect &&
        brandRect.left < lensRect.right && brandRect.right > lensRect.left &&
        brandRect.top < lensRect.bottom && brandRect.bottom > lensRect.top);
      return {
        id: preview.dataset.themePreview,
        visible: Boolean(brandRect && brandRect.width > 0 && brandRect.height > 0),
        insidePreview: Boolean(brandRect && brandRect.left >= previewRect.left &&
          brandRect.right <= previewRect.right && brandRect.top >= previewRect.top &&
          brandRect.bottom <= previewRect.bottom),
        intersectsLens,
        decorativePills: preview.querySelectorAll(':scope > i').length,
      };
    });
  });
  expect(metrics.map((entry) => entry.id)).toEqual(["se", "light", "dark"]);
  for (const metric of metrics) {
    expect(metric.visible).toBe(true);
    expect(metric.insidePreview).toBe(true);
    expect(metric.intersectsLens).toBe(false);
    expect(metric.decorativePills).toBe(0);
  }
});
