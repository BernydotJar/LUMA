import { expect, test } from "@playwright/test";

const offeringId = "a".repeat(64);
const sessionId = "private-session-1";
const classroom = `/classroom/${offeringId}/${sessionId}`;

test("the branded classroom never issues media credentials to a guest", async ({ page }) => {
  await page.goto(classroom);
  await expect(page.getByRole("heading", { name: "Tu aula te espera" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Iniciar sesión" }))
    .toHaveAttribute("href", "/login");
  await expect(page.getByText("LUMA LIVE")).toBeVisible();

  const roomToken = await page.request.post(
    `/api/live/classrooms/${offeringId}/${sessionId}/token`,
  );
  expect(roomToken.status()).toBe(401);
  expect(await roomToken.json()).toMatchObject({ error: "authentication_required" });

  const closeRoom = await page.request.post(
    `/api/live/classrooms/${offeringId}/${sessionId}/close`,
  );
  expect(closeRoom.status()).toBe(401);
  expect(await closeRoom.json()).toMatchObject({ error: "authentication_required" });

  const moderation = await page.request.post(
    `/api/live/classrooms/${offeringId}/${sessionId}/moderate`,
    { data: { action: "remove", identity: "p_" + "b".repeat(64) } },
  );
  expect(moderation.status()).toBe(401);
  expect(await moderation.json()).toMatchObject({ error: "authentication_required" });

  const attendance = await page.request.get(
    `/api/live/classrooms/${offeringId}/${sessionId}/attendance`,
  );
  expect(attendance.status()).toBe(401);
  expect(await attendance.json()).toMatchObject({ error: "authentication_required" });
});
