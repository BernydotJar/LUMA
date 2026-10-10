import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const baseURL = process.env.LUMA_AUDIT_URL ?? "http://127.0.0.1:3100";
const themes = ["se", "light", "dark"];
const routes = ["/learn", "/studio", "/experience", "/iconography", "/library", "/learn/experiences", "/learn/experience/calibracion-observar-antes-de-interpretar", "/onboarding", "/twin", "/studio/reflections", "/learn/session/pas", "/preview/liquid-light"];
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];
const report = [];
const browser = await chromium.launch({ headless: true });

for (const theme of themes) {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
    });
    await context.addInitScript(({ selectedTheme }) => {
      localStorage.setItem("luma-theme-v1", selectedTheme);
    }, { selectedTheme: theme });
    const page = await context.newPage();

    for (const route of routes) {
      await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
      const a11y = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const result = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight;
        const visible = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if (element.classList.contains("sr-only")) return false;
          if (element.closest('[aria-hidden="true"]')) return false;
          if (rect.width <= 1.5 && rect.height <= 1.5) return false;
          return style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) > 0 &&
            rect.width > 0 && rect.height > 0;
        };
        const describe = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === "string" ? element.className.slice(0, 160) : "",
            text: (element.getAttribute("aria-label") || element.textContent || "")
              .trim().replace(/\s+/g, " ").slice(0, 100),
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          };
        };
        const all = Array.from(document.querySelectorAll("body *"));
        const outOfBounds = all
          .filter(visible)
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            if (style.position === "fixed" && (rect.right <= 0 || rect.left >= viewportWidth)) return false;
            let ancestor = element.parentElement;
            while (ancestor) {
              const ancestorStyle = getComputedStyle(ancestor);
              if (["auto", "scroll", "hidden", "clip"].includes(ancestorStyle.overflowX)) return false;
              ancestor = ancestor.parentElement;
            }
            return rect.left < -3 || rect.right > viewportWidth + 3;
          })
          .slice(0, 20)
          .map(describe);
        const clippedText = Array.from(
          document.querySelectorAll("p,span,strong,small,h1,h2,h3,h4,button,a,dt,dd"),
        )
          .filter(visible)
          .filter((element) => {
            const style = getComputedStyle(element);
            const clippedX = element.scrollWidth > element.clientWidth + 2 &&
              ["hidden", "clip"].includes(style.overflowX);
            const clippedY = element.scrollHeight > element.clientHeight + 2 &&
              ["hidden", "clip"].includes(style.overflowY);
            return clippedX || clippedY;
          })
          .slice(0, 20)
          .map(describe);
        const glass = Array.from(document.querySelectorAll(".glass"));
        const nestedGlass = glass
          .filter((element) => element.parentElement?.closest(".glass"))
          .map(describe);
        const backdropElements = all.filter((element) => {
          if (!visible(element)) return false;
          const style = getComputedStyle(element);
          const backdrop = style.backdropFilter || style.webkitBackdropFilter;
          return Boolean(backdrop && backdrop !== "none");
        });
        const aboveFoldGlassArea = backdropElements.reduce((total, element) => {
          const rect = element.getBoundingClientRect();
          const left = Math.max(0, rect.left);
          const right = Math.min(viewportWidth, rect.right);
          const top = Math.max(0, rect.top);
          const bottom = Math.min(viewportHeight, rect.bottom);
          return total + Math.max(0, right - left) * Math.max(0, bottom - top);
        }, 0);
        const activeAnimations = all
          .filter(visible)
          .filter((element) => {
            const style = getComputedStyle(element);
            const durations = style.animationDuration
              .split(",")
              .map((value) => value.trim())
              .map((value) => value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000);
            return style.animationName !== "none" && durations.some((duration) => duration > 20);
          })
          .slice(0, 20)
          .map(describe);
        const fixedGlass = backdropElements.filter(
          (element) => getComputedStyle(element).position === "fixed",
        );
        const fixedGlassOverlaps = [];
        for (let i = 0; i < fixedGlass.length; i += 1) {
          for (let j = i + 1; j < fixedGlass.length; j += 1) {
            const a = fixedGlass[i].getBoundingClientRect();
            const b = fixedGlass[j].getBoundingClientRect();
            const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
              Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            if (overlap > 100) fixedGlassOverlaps.push([describe(fixedGlass[i]), describe(fixedGlass[j])]);
          }
        }
        return {
          theme: document.documentElement.dataset.theme,
          bodyTextLength: document.body.innerText.trim().length,
          errorOverlay: Boolean(document.querySelector(
            '[data-nextjs-dialog],.vite-error-overlay,#webpack-dev-server-client-overlay',
          )),
          horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - viewportWidth),
          outOfBounds,
          clippedText,
          glassCount: glass.length,
          nestedGlass,
          backdropCount: backdropElements.length,
          aboveFoldGlassCoverage: Number(
            (aboveFoldGlassArea / (viewportWidth * viewportHeight)).toFixed(2),
          ),
          activeAnimations,
          fixedGlassOverlaps,
        };
      });
      report.push({
        route,
        requestedTheme: theme,
        viewport: viewport.name,
        ...result,
        a11yViolationIds: a11y.violations.map((violation) => violation.id),
      });
    }
    await context.close();
  }
}

await browser.close();
await mkdir("evidence/glass-adversarial", { recursive: true });
const globalCSS = await readFile("src/app/globals.css", "utf8");
const hasReducedTransparencyFallback = globalCSS.includes("prefers-reduced-transparency");
const output = {
  generatedAt: new Date().toISOString(),
  baseURL,
  hasReducedTransparencyFallback,
  checks: report,
};
await writeFile(
  "evidence/glass-adversarial/report.json",
  JSON.stringify(output, null, 2) + "\n",
);

const blocking = report.filter((item) =>
  item.theme !== item.requestedTheme ||
  item.bodyTextLength === 0 ||
  item.errorOverlay ||
  item.horizontalOverflow > 0 ||
  item.outOfBounds.length > 0 ||
  item.clippedText.length > 0 ||
  item.nestedGlass.length > 0 ||
  item.activeAnimations.length > 0 ||
  item.fixedGlassOverlaps.length > 0 ||
  item.backdropCount > 14 ||
  item.aboveFoldGlassCoverage > 0.95 ||
  item.a11yViolationIds.length > 0,
);
const themeMismatch = report.filter((item) => item.theme !== item.requestedTheme);

for (const item of report) {
  console.log(
    `${item.theme.padEnd(5)} ${item.viewport.padEnd(7)} ${item.route.padEnd(14)} ` +
    `overflow=${item.horizontalOverflow} nested=${item.nestedGlass.length} ` +
    `clip=${item.clippedText.length} out=${item.outOfBounds.length} ` +
    `motion=${item.activeAnimations.length} axe=${item.a11yViolationIds.length} ` +
    `glass=${item.glassCount}/${item.backdropCount} coverage=${item.aboveFoldGlassCoverage}`,
  );
}
console.log(`reduced_transparency_fallback=${hasReducedTransparencyFallback}`);
console.log(`blocking_findings=${blocking.length + themeMismatch.length}`);

if (!hasReducedTransparencyFallback || blocking.length > 0 || themeMismatch.length > 0) {
  process.exitCode = 1;
}
