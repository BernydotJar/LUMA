import { expect, test } from "@playwright/test";

test.describe("Google authentication entry points", () => {
  test("login explains Google access and preserves a demo path", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Tu aprendizaje, con continuidad/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continuar con Google/i })).toBeVisible();
    await expect(page.getByText(/podrás elegir cómo quieres que te llamemos/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Continuar en modo demostración/i })).toHaveAttribute("href", "/learn");
  });

  test("guest learner surface offers access without pretending to know the learner name", async ({ page }) => {
    await page.goto("/learn");
    await expect(page.getByRole("link", { name: "Acceder", exact: true })).toBeVisible();
    await expect(page.getByText(/Accede para personalizar tu experiencia/i)).toBeVisible();
    await expect(page.getByText(/Buenas (días|tardes|noches), Mariana/i)).toHaveCount(0);
  });

  test("login remains within the mobile viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile geometry check.");
    await page.goto("/login");

    const result = await page.evaluate(() => {
      const visible = (element: Element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (element.closest('[aria-hidden="true"]')) return false;
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const out = Array.from(document.querySelectorAll("main *"))
        .filter(visible)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          let ancestor = element.parentElement;
          while (ancestor) {
            const style = getComputedStyle(ancestor);
            if (["hidden", "clip", "auto", "scroll"].includes(style.overflowX)) return false;
            ancestor = ancestor.parentElement;
          }
          return rect.left < -2 || rect.right > document.documentElement.clientWidth + 2;
        })
        .map((element) => element.tagName);

      return {
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        out,
      };
    });

    expect(result.scrollWidth).toBe(result.width);
    expect(result.out).toEqual([]);
  });
});
