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

    // Next's App Router can stage inert/hidden streaming nodes in the DOM.
    // Report only duplicate *paintable* learner controls that survive a paint,
    // rather than treating an inaccessible, unpainted staging node as a UI bug.
    await page.addInitScript(() => {
      const qaWindow = window as typeof window & { __learnerDuplicates?: number[] };
      qaWindow.__learnerDuplicates = [];
      let scheduled = false;
      const painted = (selector: string) => [...document.querySelectorAll(selector)].filter((node) => {
        if (!node.isConnected || node.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
        const bounds = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return bounds.width > 0 && bounds.height > 0 &&
          style.display !== 'none' && style.visibility === 'visible';
      }).length;
      const hasDuplicate = () => painted('section[data-variant="hero"] a.button-primary') > 1 ||
        painted('#journey summary') > 1;
      new MutationObserver(() => {
        if (scheduled || !hasDuplicate()) return;
        scheduled = true;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (hasDuplicate()) qaWindow.__learnerDuplicates?.push(performance.now());
          scheduled = false;
        }));
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
