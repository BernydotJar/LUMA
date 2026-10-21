import { test } from 'vitest';
import assert from 'node:assert/strict';
import { navigateToAuthenticatedQaClassroom } from './live-cloud-browser-navigation.mjs';

const URL = 'http://127.0.0.1:3462/classroom/demo-offering/demo-session';
test('navigates after response commit but requires the real hydrated Firebase QA hook', async () => {
  const calls = [];
  const page = {
    async goto(url, options) { calls.push(['goto', url, options]); },
    async waitForFunction(fn, unused, options) {
      calls.push(['hook-check', fn.toString(), unused, options]);
    },
  };
  await navigateToAuthenticatedQaClassroom(page, URL);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][1], URL);
  assert.equal(calls[0][2].waitUntil, 'commit');
  assert.equal(calls[1][3].timeout, 45000);
  assert.match(calls[1][1], /__lumaQaEmailSignIn/);
});
test('unavailable app hook or a failed browser navigation is never ignored', async () => {
  const noHook = { async goto() {}, async waitForFunction() { throw new Error('QA_HOOK_UNAVAILABLE'); } };
  await assert.rejects(navigateToAuthenticatedQaClassroom(noHook, URL), /QA_HOOK_UNAVAILABLE/);
  const navigationFailed = { async goto() { throw new Error('NETWORK_FAILURE'); },
    async waitForFunction() { throw new Error('should_not_run'); } };
  await assert.rejects(navigateToAuthenticatedQaClassroom(navigationFailed, URL), /NETWORK_FAILURE/);
});
