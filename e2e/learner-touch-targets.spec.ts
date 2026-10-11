import { expect, test } from "@playwright/test";

const themes = ["se", "light", "dark"] as const;

for (const width of [320, 390]) {
  for (const theme of themes) {
    test("guest learner actions meet 44px touch target at " + width + "px / " + theme, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile", "Touch geometry is measured in the mobile project.");
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      await page.addInitScript(id => localStorage.setItem("luma-theme-v1", id), theme);
      await page.goto("/learn");

      const goal = page.getByRole("link", { name: "Elige lo que quieres desarrollar" });
      const reason = page.getByRole("button", { name: "¿Por qué esta práctica?" });
      const secondaryAction = page.getByRole("link", { name: "Iniciar práctica" });
      const primary = page.locator('section[data-variant="hero"] a.button-primary');
      const journey = page.locator("#journey summary");

      // These are strict product invariants, not selectors that silently choose a duplicate.
      for (const control of [goal, reason, secondaryAction, primary, journey]) {
        await expect(control).toHaveCount(1);
        await expect(control).toBeVisible();
        const height = await control.evaluate(element => element.getBoundingClientRect().height);
        expect(height, "Touch target: " + control.toString() + " / " + width + "px / " + theme).toBeGreaterThanOrEqual(44);
      }

      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

      await reason.focus();
      await page.keyboard.press("Enter");
      await expect(reason).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByText("El motivo de esta sugerencia")).toBeVisible();

      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(primary).toHaveCount(1);
      await expect(journey).toHaveCount(1);
    });
  }
}

test("classroom route loads LiveKit stylesheet without placing it on learner home", async ({ page }) => {
  async function hasLiveKitCSS() {
    return page.evaluate(async () => {
      const styleLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
      const cssTexts = await Promise.all(styleLinks.map(async link => {
        try {
          const response = await fetch(link.href);
          return response.ok ? await response.text() : "";
        } catch {
          return "";
        }
      }));
      return cssTexts.some(css => css.includes(".lk-video-conference") || css.includes(".lk-prejoin"));
    });
  }

  await page.goto("/learn");
  expect(await hasLiveKitCSS(), "Do not block the learner's first paint on LiveKit classroom styles").toBe(false);

  // This is a dummy route identifier and cannot create or enter a real session.
  await page.goto("/classroom/qa-offering/qa-session");
  expect(await hasLiveKitCSS(), "Classroom must continue loading LiveKit styles").toBe(true);
});
