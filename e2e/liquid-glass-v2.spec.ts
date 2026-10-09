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
