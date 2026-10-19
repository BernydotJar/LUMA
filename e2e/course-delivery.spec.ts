import { expect, test } from "@playwright/test";

test.describe("Premium course delivery contract", () => {
  test("guest course page does not invent an entitlement or published lessons", async ({ page }) => {
    await page.goto("/learn/course");
    await expect(page.getByRole("heading", { name: "Donde dejaste el hilo." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tu curso empieza cuando accedes." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Iniciar sesión", exact: true })).toHaveAttribute("href", "/login");
    await expect(page.getByRole("link", { name: "Acceder", exact: true })).toHaveCount(1);
    await expect(page.getByText("Lección sintética", { exact: false })).toHaveCount(0);
  });

  test("guest cannot open a direct premium lesson route", async ({ page }) => {
    await page.goto("/learn/course/unauthorized-lesson");
    await expect(page.getByRole("heading", { name: "Accede para abrir tu lección" })).toBeVisible();
    await expect(page.locator("video[src]")).toHaveCount(0);
  });

  test("showcase API never exposes paid lesson or signed media data", async ({ request }) => {
    const catalog = await request.get("/api/learning/course");
    const asset = await request.get("/api/learning/course/unauthorized-lesson/asset");
    expect(catalog.status()).toBe(503);
    expect(asset.status()).toBe(503);
    expect(catalog.headers()["cache-control"]).toContain("no-store");
    expect(JSON.stringify(await catalog.json())).not.toContain("mediaObjectName");
    expect(JSON.stringify(await asset.json())).not.toContain("drive.google.com");
  });

  test("mobile course page never exceeds the viewport", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "Mobile viewport contract");
    await page.goto("/learn/course");
    await expect(page.getByRole("heading", { name: "Donde dejaste el hilo." })).toBeVisible();
    const mobileNav = page.getByRole("navigation", { name: "Navegación móvil" });
    await expect(mobileNav.getByRole("link", { name: "LUMA", exact: true })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Programa", exact: true })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Certificados", exact: true })).toBeHidden();
    const geometry = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport + 1);
  });
});
