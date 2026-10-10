import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("luma-theme-v1", "se"));
});

test("Seres preview has a bounded refractive layer behind a readable unmodified logo", async ({ page }) => {
  await page.goto("/experience", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "se");
  const preview = page.locator('[data-theme-preview="se"]:visible');
  const lens = preview.locator('[class*="seOpticalLens"]');
  const logo = preview.locator('img[alt="Seres de Excelencia"]');
  await expect(preview).toBeVisible();
  await expect(lens).toBeVisible();
  await expect(logo).toBeVisible();

  const optics = await preview.evaluate((container) => {
    const pane = container.querySelector<HTMLElement>('[class*="seOpticalLens"]');
    const brand = container.querySelector<HTMLElement>('img[alt="Seres de Excelencia"]');
    if (!pane || !brand) return null;
    const containerRect = container.getBoundingClientRect();
    const logoRect = brand.getBoundingClientRect();
    const lensRect = pane.getBoundingClientRect();
    return {
      logoAboveLens: Number(getComputedStyle(brand).zIndex) > Number(getComputedStyle(pane).zIndex),
      logoWithinPreview: logoRect.left >= containerRect.left && logoRect.right <= containerRect.right &&
        logoRect.top >= containerRect.top && logoRect.bottom <= containerRect.bottom,
      lensWithinPreview: lensRect.left >= containerRect.left && lensRect.right <= containerRect.right &&
        lensRect.top >= containerRect.top && lensRect.bottom <= containerRect.bottom,
      backdrop: getComputedStyle(pane).backdropFilter,
      interceptsPointer: getComputedStyle(pane).pointerEvents,
      logoFilter: getComputedStyle(brand).filter,
    };
  });
  expect(optics).not.toBeNull();
  expect(optics?.logoAboveLens).toBe(true);
  expect(optics?.logoWithinPreview).toBe(true);
  expect(optics?.lensWithinPreview).toBe(true);
  expect(optics?.interceptsPointer).toBe("none");
  expect(optics?.backdrop).toContain("blur(9px)");
  expect(optics?.logoFilter).not.toContain("url(");
  await expect(page.locator(".glass .glass")).toHaveCount(0);
});

test("Seres uses functional glass in navigation without wrapping content cards", async ({ page, isMobile }) => {
  await page.goto("/learn", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "se");
  const chrome = isMobile
    ? page.locator('nav[class*="mobileNav"]').first()
    : page.locator('aside[class*="sidebar"]').first();
  await expect(chrome).toBeVisible();
  const backdrop = await chrome.evaluate((element) => getComputedStyle(element).backdropFilter);
  expect(backdrop).toContain("blur(");
  await expect(page.locator(".glass .glass")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("reduced transparency turns off Seres refraction and navigation backdrop", async ({ page, isMobile }) => {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
  });
  await page.goto("/experience", { waitUntil: "domcontentloaded" });
  const preview = page.locator('[data-theme-preview="se"]:visible [class*="seOpticalLens"]');
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((element) => getComputedStyle(element).backdropFilter)).toBe("none");
  const chrome = isMobile
    ? page.locator('nav[class*="mobileNav"]').first()
    : page.locator('aside[class*="sidebar"]').first();
  expect(await chrome.evaluate((element) => getComputedStyle(element).backdropFilter)).toBe("none");
  await session.detach();
});

test("theme selection remains exclusive and accessible", async ({ page }) => {
  await page.goto("/experience", { waitUntil: "domcontentloaded" });
  const cards = page.locator('button[aria-pressed][class*="themeCard"]');
  await expect(cards).toHaveCount(3);
  for (const id of ["light", "dark", "se"]) {
    await cards.filter({ has: page.locator(`[data-theme-preview="${id}"]`) }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", id);
    await expect(page.locator('button[aria-pressed="true"][class*="themeCard"]')).toHaveCount(1);
  }
});
