import { webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";

const origin = process.env.LUMA_AUDIT_URL ?? "http://127.0.0.1:3150";
const scenarios = [
  ...["se", "light", "dark"].flatMap((theme) => ["desktop", "mobile"].map((viewport) => ({ theme, viewport, route: "/experience" }))),
  { theme: "se", viewport: "mobile", route: "/library" },
  { theme: "light", viewport: "mobile", route: "/library" },
  { theme: "light", viewport: "desktop", route: "/studio/learners/mariana" },
  { theme: "light", viewport: "mobile", route: "/studio/learners/mariana" },
];
const browser = await webkit.launch({ headless: true });
const results = [];
try {
  for (const task of scenarios) {
    const viewport = task.viewport === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript((theme) => localStorage.setItem("luma-theme-v1", theme), task.theme);
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    const response = await page.goto(origin + task.route, { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(500);
    const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const metrics = await page.evaluate(() => {
      const preview = [...document.querySelectorAll('[data-theme-preview="se"]')].find((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      });
      const logo = preview?.querySelector('img[alt="Seres de Excelencia"]');
      const pane = preview?.querySelector('[class*="seOpticalLens"]');
      const pr = preview?.getBoundingClientRect();
      const lr = logo?.getBoundingClientRect();
      const cs = pane ? getComputedStyle(pane) : null;
      return {
        loadedTheme: document.documentElement.dataset.theme,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        nestedGlass: document.querySelectorAll('.glass .glass').length,
        logoVisible: Boolean(pr && lr && lr.width && lr.height && lr.left >= pr.left && lr.right <= pr.right && lr.top >= pr.top && lr.bottom <= pr.bottom),
        logoAbovePane: Boolean(logo && pane && Number(getComputedStyle(logo).zIndex) > Number(getComputedStyle(pane).zIndex)),
        lensBackdrop: cs?.backdropFilter || cs?.webkitBackdropFilter || "none",
      };
    });
    if (task.theme === "se" && task.route === "/experience") {
      await page.locator('[data-theme-preview="se"]:visible').first().screenshot({ path: `evidence/se-liquid-glass-v4/webkit-${task.viewport}.png` });
    }
    results.push({ ...task, status: response?.status() ?? 0, ...metrics, pageErrors, axeViolationIds: a11y.violations.map((v) => v.id) });
    await context.close();
  }
} finally {
  await browser.close();
}
const failures = results.filter((r) => r.status !== 200 || r.loadedTheme !== r.theme || r.overflow > 0 || r.nestedGlass > 0 || r.pageErrors.length > 0 || r.axeViolationIds.length > 0 ||
  (r.route === "/experience" && (!r.logoVisible || !r.logoAbovePane || !r.lensBackdrop.includes("blur(9px)"))));
await writeFile('evidence/se-liquid-glass-v4/webkit-audit.json', JSON.stringify({ engine: 'WebKit Linux', total: results.length, passed: results.length - failures.length, failures, results }, null, 2) + '\n');
console.log(`webkit_checks=${results.length} passed=${results.length-failures.length} failures=${failures.length}`);
if (failures.length) { console.log(JSON.stringify(failures, null, 2)); process.exitCode = 1; }
