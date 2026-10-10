import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseURL = process.env.LUMA_AUDIT_URL ?? "http://127.0.0.1:3148";
const cases = [
  ...["se", "light", "dark"].flatMap((theme) => ["desktop", "mobile"].map((viewport) => ({ theme, viewport, route: "/experience" }))),
  ...["desktop", "mobile"].flatMap((viewport) => ["/learn", "/studio"].map((route) => ({ theme: "se", viewport, route }))),
];
const browser = await chromium.launch({ headless: true });
const results = [];
await mkdir("evidence/se-liquid-glass-v4", { recursive: true });
try {
  for (const item of cases) {
    const viewport = item.viewport === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 };
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript((theme) => localStorage.setItem("luma-theme-v1", theme), item.theme);
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    const response = await page.goto(baseURL + item.route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(350);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const metrics = await page.evaluate(() => {
      const preview = Array.from(document.querySelectorAll('[data-theme-preview="se"]')).find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden';
      });
      const lens = preview?.querySelector('[class*="seOpticalLens"]');
      const logo = preview?.querySelector('img[alt="Seres de Excelencia"]');
      const pr = preview?.getBoundingClientRect();
      const lr = logo?.getBoundingClientRect();
      return {
        loadedTheme: document.documentElement.dataset.theme,
        overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        nestedGlass: document.querySelectorAll(".glass .glass").length,
        logoVisible: Boolean(pr && lr && lr.width > 0 && lr.height > 0 && lr.left >= pr.left && lr.right <= pr.right && lr.top >= pr.top && lr.bottom <= pr.bottom),
        lensFilter: lens ? getComputedStyle(lens).backdropFilter : null,
        logoAboveLens: Boolean(logo && lens && Number(getComputedStyle(logo).zIndex) > Number(getComputedStyle(lens).zIndex)),
      };
    });
    if (item.route === "/experience" && item.theme === "se") {
      await page.locator('[data-theme-preview="se"]:visible').first().screenshot({
        path: `evidence/se-liquid-glass-v4/seres-preview-${item.viewport}.png`,
      });
    }
    results.push({ ...item, status: response?.status() ?? 0, ...metrics, pageErrors, axe: axe.violations.map((x) => x.id) });
    await context.close();
  }
} finally {
  await browser.close();
}
const fail = results.filter((r) => r.status !== 200 || r.loadedTheme !== r.theme || r.overflow > 0 || r.nestedGlass > 0 || r.axe.length || r.pageErrors.length ||
  (r.route === "/experience" && (!r.logoVisible || !r.logoAboveLens || !r.lensFilter?.includes("blur(9px)"))));
await writeFile("evidence/se-liquid-glass-v4/audit.json", JSON.stringify({ baseURL, passed: results.length - fail.length, total: results.length, failures: fail, results }, null, 2) + "\n");
console.log(`seres_optical_checks=${results.length} passed=${results.length - fail.length} failures=${fail.length}`);
if (fail.length) { console.log(JSON.stringify(fail, null, 2)); process.exitCode = 1; }
