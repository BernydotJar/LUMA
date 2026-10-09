import { expect, test } from "@playwright/test";

const routes = ["/experience", "/iconography", "/library", "/studio", "/studio/class-intelligence", "/studio/reflections"];

test("enterprise surfaces do not expose internal delivery artifacts", async ({ page }) => {
  // Cold Next.js compilation of six routes can exceed the default teardown timeout.
  test.slow();
  for (const route of routes) {
    await page.goto(route);
    const body = await page.locator("body").innerText();
    for (const pattern of [
      /LUMA-0\d{2}/i, /grafos de entrega/i, /prototipo\s*0?1/i,
      /15\.82\s*GiB/i, /vertical slice/i, /SVG baseline/i,
      /movimiento bloqueado/i, /pipelineVersion/i, /promptVersion/i,
      /recibo de ejecuci[oó]n/i, /en modo demostraci[oó]n/i,
    ]) {
      expect(body, `${route} shows internal text: ${pattern}`).not.toMatch(pattern);
    }
  }
});

test("experience configuration offers real next steps", async ({ page }) => {
  await page.goto("/experience");
  await expect(page.getByRole("heading", { name: /Una experiencia de aprendizaje conectada/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Del objetivo a una acci[oó]n/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Definir objetivo/i })).toHaveAttribute("href", "/onboarding");
  await expect(page.getByRole("link", { name: /Explorar experiencias/i })).toHaveAttribute("href", "/learn/experiences");
  await expect(page.getByRole("link", { name: /Abrir seguimiento/i }).first()).toHaveAttribute("href", "/studio");
});

test("unauthenticated coach dashboard does not invent business outcomes", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByText(/Accede para consultar a tus participantes/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Iniciar sesi[oó]n/i })).toHaveAttribute("href", "/login");
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("+18.4%");
  expect(body).not.toContain("128");
  expect(body).not.toContain("n=46");
  expect(body).not.toContain("Corpus sincronizado");
});
