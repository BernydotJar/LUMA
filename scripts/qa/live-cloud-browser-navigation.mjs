/** Deterministic real-browser QA navigation under cold Next.js compilation.
 * A document's DOMContentLoaded event may be delayed on first development load,
 * so verify that LUMA's actual isolated QA Firebase login hook is available.
 * No receipt is accepted unless the subsequently authenticated classroom UI
 * and real media/authorization assertions all pass.
 */
export async function navigateToAuthenticatedQaClassroom(page, url) {
  await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
  await page.waitForFunction(
    () => typeof window.__lumaQaEmailSignIn === 'function',
    null, { timeout: 45000 },
  );
}
