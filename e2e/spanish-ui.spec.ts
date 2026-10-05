import { expect, test } from "@playwright/test";

const routes = [
  "/learn",
  "/learn/experiences",
  "/studio",
  "/studio/learners/mariana",
  "/library",
  "/experience",
  "/iconography",
  "/studio/reflections",
];

const forbiddenUiLabels = [
  "Coachee",
  "coachee",
  "Coach Studio",
  "Learning Twin",
  "Content Intelligence",
  "Curriculum Reflection",
  "Experience Console",
  "Journey",
  "journey",
  "Theme system",
  "Review lab",
  "Role preview",
  "Profile architecture",
  "Delivery graphs",
  "Knowledge Reflection",
  "Claims ",
  "Claim ",
  "Liquid Light",
  "Nocturne Intelligence",
];

test("client-facing product terminology stays in Spanish", async ({ page }) => {
  for (const route of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    const body = await page.locator("body").innerText();

    for (const label of forbiddenUiLabels) {
      expect(body, `${route} leaked English UI label: ${label}`).not.toContain(label);
    }
  }
});
