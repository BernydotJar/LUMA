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


/** Match a real first-time participant: wait for AuthProvider to settle before
 * emulator sign-in. The QA hook is initialized at module load, which alone
 * does NOT prove the React auth observer has subscribed or completed hydration.
 */
export async function awaitLoggedOutQaLobby(page) {
  await page.getByRole('heading', { name: 'Tu aula te espera', exact: true })
    .waitFor({ state: 'visible', timeout: 45000 });
}
