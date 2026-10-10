import { chromium, devices, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertManifest, invariant, PRODUCTION_URL } from './policy.mjs';
const out = resolve(process.env.RELEASE_DIR ?? '/tmp/luma-release');
mkdirSync(resolve(out, 'screenshots'), { recursive: true });
const manifest = assertManifest(JSON.parse(readFileSync(resolve(out, 'manifest.json'), 'utf8')));
const routes = ['/', '/experience', '/learn', '/studio', '/library', '/studio/certificates'];
const result = { status: 'RUNNING', gitSha: manifest.gitSha, url: PRODUCTION_URL, routes: [], checks: [], errors: [] };
const browser = await chromium.launch();
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext(mobile ? { ...devices['iPhone 14'] } : { viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => result.errors.push({ type: 'javascript', message: error.message }));
    page.on('response', response => {
      if (response.status() >= 500 && new URL(response.url()).origin === PRODUCTION_URL) result.errors.push({ type: 'http', status: response.status(), path: new URL(response.url()).pathname });
    });
    const version = await context.request.get(`${PRODUCTION_URL}/api/version`);
    invariant(version.ok(), 'Version endpoint failed');
    assertManifest(await version.json(), manifest.gitSha);
    const health = await context.request.get(`${PRODUCTION_URL}/api/health`);
    invariant(health.ok(), 'HTTP health check failed');
    for (const route of routes) {
      const response = await page.goto(PRODUCTION_URL + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
      invariant(response?.ok(), `Route failed: ${route}`);
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
      result.routes.push({ route, mobile, status: response.status(), destination: new URL(page.url()).pathname });
      await page.screenshot({ path: resolve(out, 'screenshots', `${mobile ? 'mobile' : 'desktop'}-${route.replaceAll('/', '_') || 'root'}.png`) });
    }
    await page.goto(`${PRODUCTION_URL}/learn`);
    const theme = page.getByRole('button', { name: /Cambiar tema/ });
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'se');
    result.checks.push({ name: 'three-themes-and-persistence', mobile, status: 'PASS' });
    for (const route of ['/studio', '/studio/certificates', '/studio/reflections']) {
      await page.goto(PRODUCTION_URL + route);
      const nav = page.getByRole('navigation', { name: mobile ? 'Navegación móvil' : 'Navegación del entrenador', exact: true });
      if (mobile && route === '/studio/reflections') await nav.locator('summary').click();
      const active = nav.locator('[aria-current="page"]');
      await expect(active).toHaveCount(1);
      await expect(active).toHaveAttribute('href', route);
      await expect(active).toBeVisible();
    }
    result.checks.push({ name: 'single-active-studio-navigation', mobile, status: 'PASS' });
    await page.goto(`${PRODUCTION_URL}/studio`);
    const signIn = page.getByRole('link', { name: /Iniciar sesión/i }).first();
    await expect(signIn).toBeVisible();
    const destination = new URL(await signIn.getAttribute('href'), PRODUCTION_URL);
    invariant(destination.origin === PRODUCTION_URL, 'Unexpected authentication destination');
    await signIn.click();
    await expect(page).toHaveURL(destination.href);
    for (const path of ['/api/coach/learners', '/api/certificates/console']) {
      const response = await context.request.get(PRODUCTION_URL + path);
      invariant([401, 403].includes(response.status()), `Unauthenticated access is not denied: ${path}`);
    }
    result.checks.push({ name: 'unauthenticated-role-boundary-and-login-navigation', mobile, status: 'PASS' });
    await context.close();
  }
  invariant(result.errors.length === 0, 'Production JavaScript or HTTP 5xx errors detected');
  result.status = 'PASS';
} catch (error) {
  result.status = 'FAIL'; result.errors.push({ type: 'assertion', message: error.message });
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(resolve(out, 'smoke.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`Production smoke: ${result.status}`);
}
