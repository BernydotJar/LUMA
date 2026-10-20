import { expect, test } from "@playwright/test";

const clientZones = ["UTC", "America/Guatemala", "America/Los_Angeles"];

for (const timezoneId of clientZones) {
  test("static learner greeting hydrates without DOM replacement in " + timezoneId, async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      timezoneId,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Catch even short-lived duplicate subtrees during asynchronous hydration.
    await page.addInitScript(() => {
      const qaWindow = window as typeof window & { __learnerDuplicates?: number[] };
      qaWindow.__learnerDuplicates = [];
      new MutationObserver(() => {
        const ctas = document.querySelectorAll('section[data-variant="hero"] a.button-primary').length;
        const journeys = document.querySelectorAll("#journey summary").length;
        if (ctas > 1 || journeys > 1) qaWindow.__learnerDuplicates?.push(performance.now());
      }).observe(document, { childList: true, subtree: true });
    });

    try {
      const response = await page.request.get("/learn");
      expect(response.ok()).toBe(true);
      const html = await response.text();
      // The pre-rendered HTML must be deterministic; the local time is client-only.
      expect(html).toMatch(/learner-greeting_greeting[^"]*">Hola/);

      await page.goto("/learn", { waitUntil: "domcontentloaded" });
      // The app-router may stage an inert copy while hydrating. Assert the
      // ONE visible learner greeting, not every transient streaming node.
      // The mutation observer still rejects any duplicate practice CTA/route.
      const visibleGreeting = page.locator('[class*="learner-greeting_greeting"]:visible');
      await expect(visibleGreeting, "Exactly one greeting may be user-visible").toHaveCount(1);
      await expect(visibleGreeting).toContainText(/Buenos días|Buenas tardes|Buenas noches/);
      await expect(page.locator('section[data-variant="hero"] a.button-primary')).toHaveCount(1);
      await expect(page.locator("#journey summary")).toHaveCount(1);
      await page.waitForTimeout(600);
      const duplication = await page.evaluate(
        () => (window as typeof window & { __learnerDuplicates?: number[] }).__learnerDuplicates ?? [],
      );
      expect(duplication, "Hydration must not insert a second learner subtree").toEqual([]);
      expect(errors, "Client and static server markup must not produce React hydration errors").toEqual([]);

      await page.reload();
      await expect(page.locator('section[data-variant="hero"] a.button-primary')).toHaveCount(1);
      await expect(page.locator("#journey summary")).toHaveCount(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
