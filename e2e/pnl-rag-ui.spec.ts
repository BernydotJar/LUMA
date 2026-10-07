import { expect, test, type Page } from "@playwright/test";

async function sendTutorMessage(page: Page, message: string) {
  await page.goto("/learn", { waitUntil: "domcontentloaded" });

  const input = page.getByRole("textbox", { name: "Pregunta a LUMA" });
  const send = page.getByRole("button", { name: "Enviar pregunta" });
  await expect(input).toBeVisible();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await input.fill("");
    await input.fill(message);
    if (await send.isEnabled()) break;
    await page.waitForTimeout(100);
  }

  await expect(send).toBeEnabled({ timeout: 5_000 });
  await send.click();
}

test.describe("PNL RAG learner evidence", () => {
  test("shows corpus provenance and time window without leaking server paths", async ({ page }) => {
    await sendTutorMessage(page, "Explícame el cordón umbilical");

    await expect(
      page.getByText(/Según el corpus audiovisual procesado/i),
    ).toBeVisible({ timeout: 20_000 });

    const evidence = page.getByRole("link", {
      name: /Clase PNL\.mp4 · 00:04:53 → 00:06:25/i,
    });
    await expect(evidence).toBeVisible();
    await expect(evidence).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/drive-pnl-001/view",
    );
    await expect(evidence).toHaveAttribute(
      "title",
      "gdrive_pnl_001 · chunk-pnl-001",
    );

    await expect(
      page.getByText("/private/outputs/clase.srt"),
    ).toHaveCount(0);
    await expect(
      page.getByText("/private/outputs/clase.txt"),
    ).toHaveCount(0);
  });

  test("shows strict insufficient-evidence behavior instead of deterministic fallback", async ({ page }) => {
    await sendTutorMessage(page, "zxqv no existe en el corpus");

    await expect(
      page.getByText(
        "No encontré evidencia suficiente en el corpus procesado.",
      ),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/Un P\.A\.S\. es un pensamiento automático/i),
    ).toHaveCount(0);
  });
});
