import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseURL = process.env.LUMA_AUDIT_URL ?? "http://127.0.0.1:3100";

const viewports = [
  { name: "mobile-375", width: 375, height: 667, mobile: true },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-430", width: 430, height: 932, mobile: true },
  { name: "tablet-1024", width: 1024, height: 768, mobile: false },
  { name: "desktop-1280", width: 1280, height: 800, mobile: false },
  { name: "desktop-1440", width: 1440, height: 1000, mobile: false },
];

const primaryRoutes = ["/login", "/learn", "/learn/experiences", "/studio"];
const secondaryRoutes = [
  "/learn/experience/calibracion-observar-antes-de-interpretar",
  "/studio/learners/mariana",
  "/library",
  "/experience",
  "/studio/reflections",
  "/studio/class-intelligence",
];
const themes = ["se", "light", "dark"];
const a11yViewportNames = new Set(["mobile-375", "tablet-1024", "desktop-1440"]);

const report = [];
let browser = await chromium.launch({ headless: true });

function blocking(item) {
  return (
    item.horizontalOverflow > 0 ||
    item.outOfBounds.length > 0 ||
    item.clippedText.length > 0 ||
    item.a11yViolationIds.length > 0 ||
    item.topbarCollision ||
    item.mobileNavObstructions.length > 0 ||
    item.errorOverlay ||
    !item.primaryHeadingVisible
  );
}

async function inspectGeometry(page, isMobile) {
  return page.evaluate(({ isMobile }) => {
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;

    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (element.classList.contains("sr-only")) return false;
      if (element.closest('[aria-hidden="true"]')) return false;
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        rect.width > 1 &&
        rect.height > 1
      );
    };

    const describe = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        text: (element.getAttribute("aria-label") || element.textContent || "")
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 100),
        className: typeof element.className === "string" ? element.className.slice(0, 120) : "",
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
        },
      };
    };

    const all = Array.from(document.querySelectorAll("body *"));

    const outOfBounds = all
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        let ancestor = element.parentElement;
        while (ancestor) {
          const style = getComputedStyle(ancestor);
          if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)) return false;
          ancestor = ancestor.parentElement;
        }
        return rect.left < -3 || rect.right > width + 3;
      })
      .slice(0, 20)
      .map(describe);

    const clippedText = Array.from(
      document.querySelectorAll("p,span,strong,small,h1,h2,h3,h4,button,a,label,input,textarea"),
    )
      .filter(visible)
      .filter((element) => {
        const style = getComputedStyle(element);
        const clippedX =
          element.scrollWidth > element.clientWidth + 2 &&
          ["hidden", "clip"].includes(style.overflowX) &&
          style.textOverflow !== "ellipsis";
        const clippedY =
          element.scrollHeight > element.clientHeight + 2 &&
          ["hidden", "clip"].includes(style.overflowY);
        return clippedX || clippedY;
      })
      .slice(0, 20)
      .map(describe);

    const threshold = isMobile ? 44 : 40;
    const smallTargets = Array.from(
      document.querySelectorAll("a,button,input,select,textarea,[role=button],[role=tab]"),
    )
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (element.tagName === "A" && style.display === "inline") return false;
        return rect.width < threshold || rect.height < threshold;
      })
      .slice(0, 30)
      .map(describe);

    const title = document.querySelector('[class*="pageTitle"]');
    const actions = document.querySelector('[class*="topbarActions"]');
    let topbarCollision = false;
    if (title && actions && visible(title) && visible(actions)) {
      const a = title.getBoundingClientRect();
      const b = actions.getBoundingClientRect();
      topbarCollision =
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
          Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) >
        16;
    }

    const heading = document.querySelector("h1,h2")?.getBoundingClientRect();
    const activeAnimations = all
      .filter(visible)
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.animationName === "none") return false;
        return style.animationDuration
          .split(",")
          .map((value) => value.trim())
          .map((value) => (value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000))
          .some((duration) => duration > 20);
      })
      .slice(0, 20)
      .map(describe);

    const siblingPatternWarnings = [];
    for (const container of Array.from(document.querySelectorAll("section,main,div"))) {
      const children = Array.from(container.children).filter(visible);
      const structural = children.filter((child) => ["ARTICLE", "SECTION", "DIV"].includes(child.tagName));
      if (structural.length < 6) continue;
      const signatures = structural.map((child) => {
        const style = getComputedStyle(child);
        const rect = child.getBoundingClientRect();
        return [
          child.tagName,
          Math.round(rect.width / 20) * 20,
          Math.round(rect.height / 20) * 20,
          style.borderRadius,
        ].join("|");
      });
      const counts = new Map();
      for (const signature of signatures) counts.set(signature, (counts.get(signature) || 0) + 1);
      const repeated = Math.max(...counts.values());
      if (repeated >= 6) siblingPatternWarnings.push({ repeated, container: describe(container) });
      if (siblingPatternWarnings.length >= 5) break;
    }

    return {
      bodyTextLength: document.body.innerText.trim().length,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - width),
      outOfBounds,
      clippedText,
      smallTargets,
      topbarCollision,
      activeAnimations,
      siblingPatternWarnings,
      errorOverlay: Boolean(
        document.querySelector('[data-nextjs-dialog],.vite-error-overlay,#webpack-dev-server-client-overlay'),
      ),
      primaryHeadingVisible: Boolean(
        heading && heading.top < height && heading.bottom > 0 && heading.width > 0 && heading.height > 0,
      ),
    };
  }, { isMobile });
}

for (const viewport of viewports) {
  for (const theme of themes) {
    const routes = theme === "se" ? [...primaryRoutes, ...secondaryRoutes] : primaryRoutes;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
    });
    await context.addInitScript(({ selectedTheme }) => {
      localStorage.setItem("luma-theme-v1", selectedTheme);
    }, { selectedTheme: theme });
    const page = await context.newPage();

    for (const route of routes) {
      await page.goto(baseURL + route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

      const geometry = await inspectGeometry(page, viewport.mobile);
      let a11yViolationIds = [];
      if (a11yViewportNames.has(viewport.name) && primaryRoutes.includes(route)) {
        try {
          const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
          a11yViolationIds = a11y.violations.map((item) => item.id);
        } catch (error) {
          a11yViolationIds = ["axe-runtime-error"];
          console.error("axe-runtime-error", viewport.name, theme, route, String(error));
        }
      }

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(50);
      const mobileNavObstructions = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Navegación móvil"]');
        if (!nav || getComputedStyle(nav).display === "none") return [];
        const navRect = nav.getBoundingClientRect();
        const elements = Array.from(
          document.querySelectorAll("main a,main button,main input,main textarea,main [role=button]"),
        );
        return elements
          .filter((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            if (style.display === "none" || style.visibility === "hidden" || rect.width <= 1 || rect.height <= 1) return false;
            const overlapX = Math.max(0, Math.min(rect.right, navRect.right) - Math.max(rect.left, navRect.left));
            const overlapY = Math.max(0, Math.min(rect.bottom, navRect.bottom) - Math.max(rect.top, navRect.top));
            const overlap = overlapX * overlapY;
            return overlap > rect.width * rect.height * 0.35;
          })
          .slice(0, 10)
          .map((element) =>
            (element.getAttribute("aria-label") || element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
          );
      });

      await page.evaluate(() => window.scrollTo(0, 0));
      const focusOrder = [];
      for (let i = 0; i < 6; i += 1) {
        await page.keyboard.press("Tab");
        focusOrder.push(
          await page.evaluate(() => {
            const element = document.activeElement;
            if (!element) return "";
            return (element.getAttribute("aria-label") || element.textContent || element.tagName)
              .trim()
              .replace(/\s+/g, " ")
              .slice(0, 80);
          }),
        );
      }

      const entry = {
        route,
        theme,
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        ...geometry,
        mobileNavObstructions,
        focusOrder,
        a11yViolationIds,
      };
      entry.blocking = blocking(entry);
      report.push(entry);
    }
    await context.close();
  }
}

await browser.close();

await mkdir("evidence/uiux-adversarial", { recursive: true });
await writeFile(
  "evidence/uiux-adversarial/report.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), baseURL, scenarios: report }, null, 2) + "\n",
);

const blockingFindings = report.filter((item) => item.blocking);
const smallTargetWarnings = report.filter((item) => item.smallTargets.length > 0);
const patternWarnings = report.filter((item) => item.siblingPatternWarnings.length > 0);
const motionWarnings = report.filter((item) => item.activeAnimations.length > 0);
const focusFailures = report.filter((item) => new Set(item.focusOrder.filter(Boolean)).size < 2);

const summary = [
  "# LUMA UI/UX Adversarial Audit",
  "",
  `Scenarios: ${report.length}`,
  `Blocking scenarios: ${blockingFindings.length}`,
  `Small-target warning scenarios: ${smallTargetWarnings.length}`,
  `Repeated-pattern warning scenarios: ${patternWarnings.length}`,
  `Reduced-motion animation warning scenarios: ${motionWarnings.length}`,
  `Focus-order warning scenarios: ${focusFailures.length}`,
  "",
  "## Blocking findings",
  blockingFindings.length
    ? blockingFindings
        .map((item) =>
          `- ${item.viewport} · ${item.theme} · ${item.route}: overflow=${item.horizontalOverflow}, out=${item.outOfBounds.length}, clip=${item.clippedText.length}, axe=${item.a11yViolationIds.join(",") || "0"}, topbarCollision=${item.topbarCollision}, mobileNav=${item.mobileNavObstructions.length}`,
        )
        .join("\n")
    : "- None.",
  "",
  "## Warning concentration",
  `- Small targets: ${smallTargetWarnings.slice(0, 20).map((item) => `${item.viewport}:${item.route}(${item.smallTargets.length})`).join(", ") || "none"}`,
  `- Repeated sibling patterns: ${patternWarnings.slice(0, 20).map((item) => `${item.viewport}:${item.route}`).join(", ") || "none"}`,
  `- Reduced-motion active animation: ${motionWarnings.slice(0, 20).map((item) => `${item.viewport}:${item.route}`).join(", ") || "none"}`,
  `- Focus order: ${focusFailures.slice(0, 20).map((item) => `${item.viewport}:${item.route}`).join(", ") || "none"}`,
  "",
].join("\n");

await writeFile("evidence/uiux-adversarial/summary.md", summary);
console.log(summary);

if (blockingFindings.length > 0) process.exitCode = 1;
