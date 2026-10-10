import { expect, test, type Page } from "@playwright/test";

const firstScreenSizes = [
  { width: 390, height: 844 },
  { width: 428, height: 926 },
];
const compactSizes = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
];
const themeIds = ["se", "light", "dark"] as const;

async function measureMobileGeometry(page: Page) {
  return page.evaluate(() => {
    const button = document.querySelector<HTMLAnchorElement>(
      'section[data-variant="hero"] a.button-primary',
    );
    const nav = document.querySelector<HTMLElement>(
      'nav[aria-label="Navegación móvil"]',
    );

    if (!button || !nav) return null;
    const action = button.getBoundingClientRect();
    const tabs = nav.getBoundingClientRect();
    const x = action.left + action.width / 2;
    const y = action.top + action.height / 2;
    const hit = document.elementFromPoint(x, y);

    return {
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewportHeight: window.innerHeight,
      buttonTop: action.top,
      buttonBottom: action.bottom,
      buttonHeight: action.height,
      navTop: tabs.top,
      navBottom: tabs.bottom,
      clearance: tabs.top - action.bottom,
      buttonCenterUnobstructed: Boolean(hit && (button === hit || button.contains(hit))),
      theme: document.documentElement.dataset.theme,
    };
  });
}

test.describe("LUMA P0 mobile CTA geometry", () => {
  for (const theme of themeIds) {
    for (const size of firstScreenSizes) {
      test(`CTA is fully accessible above bottom nav at ${size.width}x${size.height} / ${theme}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "mobile", "Mobile viewport geometry only");
        await page.setViewportSize(size);
        await page.addInitScript((id: string) => {
          window.localStorage.setItem("luma-theme-v1", id);
        }, theme);
        await page.goto("/learn");
        const cta = page.locator('section[data-variant="hero"] a.button-primary');
        await expect(cta).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Navegación móvil" })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        const geometry = await measureMobileGeometry(page);
        expect(geometry).not.toBeNull();
        expect(geometry!.scrollWidth).toBe(geometry!.viewportWidth);
        expect(geometry!.buttonHeight).toBeGreaterThanOrEqual(44);
        expect(geometry!.buttonTop).toBeGreaterThanOrEqual(0);
        expect(geometry!.buttonBottom).toBeLessThanOrEqual(geometry!.navTop - 8);
        expect(geometry!.buttonCenterUnobstructed).toBe(true);
      });
    }
  }

  for (const size of compactSizes) {
    test(`CTA remains reachable after scroll at ${size.width}x${size.height}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile", "Mobile viewport geometry only");
      await page.setViewportSize(size);
      await page.goto("/learn");
      const cta = page.locator('section[data-variant="hero"] a.button-primary');
      await expect(cta).toHaveCount(1);
      await cta.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await expect(cta).toBeVisible();
      const geometry = await measureMobileGeometry(page);
      expect(geometry).not.toBeNull();
      expect(geometry!.scrollWidth).toBe(geometry!.viewportWidth);
      expect(geometry!.buttonHeight).toBeGreaterThanOrEqual(44);
      expect(geometry!.buttonTop).toBeGreaterThanOrEqual(0);
      expect(geometry!.buttonBottom).toBeLessThanOrEqual(geometry!.navTop - 8);
      expect(geometry!.buttonCenterUnobstructed).toBe(true);
    });
  }
});
