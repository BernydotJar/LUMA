import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const routes = ["/", "/learn", "/twin", "/studio/learners/mariana", "/library", "/experience", "/iconography", "/studio", "/studio/reflections", "/onboarding", "/learn/session/pas", "/learn/experiences", "/learn/experience/calibracion-observar-antes-de-interpretar"];
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const report = [];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:3100${route}`, { waitUntil: "networkidle" });
    const result = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const interactive = Array.from(document.querySelectorAll("a, button, input, select, textarea"));
      const visible = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (el.classList.contains("sr-only")) return false;
        if (el.closest('[aria-hidden="true"]')) return false;
        if (rect.width <= 1.5 && rect.height <= 1.5) return false;
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
      };
      const describe = (el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 90),
        rect: (() => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
        })(),
      });
      const outOfBounds = Array.from(document.querySelectorAll("body *"))
        .filter(visible)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (style.position === "fixed" && (r.right <= 0 || r.left >= vw)) return false;
          const scrollParent = el.parentElement && getComputedStyle(el.parentElement);
          if (scrollParent && ["auto", "scroll"].includes(scrollParent.overflowX)) return false;
          return r.left < -3 || r.right > vw + 3;
        })
        .slice(0, 20)
        .map(describe);
      const smallTargets = interactive
        .filter(visible)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (el.tagName === "A" && style.display === "inline") return false;
          return r.width < 40 || r.height < 40;
        })
        .slice(0, 30)
        .map(describe);
      const clippedText = Array.from(document.querySelectorAll("p, span, strong, small, h1, h2, h3, button, a"))
        .filter(visible)
        .filter((el) => {
          const style = getComputedStyle(el);
          const clippedX = el.scrollWidth > el.clientWidth + 2 && ["hidden", "clip"].includes(style.overflowX);
          const clippedY = el.scrollHeight > el.clientHeight + 2 && ["hidden", "clip"].includes(style.overflowY);
          return clippedX || clippedY;
        })
        .slice(0, 20)
        .map(describe);
      const primaryHeading = document.querySelector("h1, h2")?.getBoundingClientRect();
      return {
        title: document.title,
        viewport: { width: vw, height: window.innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - vw),
        outOfBounds,
        smallTargets,
        clippedText,
        primaryHeadingVisible: Boolean(primaryHeading && primaryHeading.top < window.innerHeight && primaryHeading.bottom > 0),
      };
    });
    report.push({ route, viewportName: viewport.name, ...result });
  }
  await page.close();
}

await browser.close();
await writeFile("evidence/verification/visual-layout-audit.json", JSON.stringify(report, null, 2));

for (const item of report) {
  console.log(`${item.viewportName.padEnd(7)} ${item.route.padEnd(20)} overflow=${item.horizontalOverflow} out=${item.outOfBounds.length} small=${item.smallTargets.length} clipped=${item.clippedText.length} heading=${item.primaryHeadingVisible}`);
  if (item.outOfBounds.length) console.log("  out:", item.outOfBounds.slice(0, 4));
  if (item.clippedText.length) console.log("  clipped:", item.clippedText.slice(0, 4));
}
