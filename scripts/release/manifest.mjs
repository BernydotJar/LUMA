import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertManifest, invariant, REPOSITORY } from './policy.mjs';
const root = resolve(import.meta.dirname, '../..');
const destination = resolve(root, 'src/generated/release-manifest.json');
// Archives preserve the verified manifest; never infer a parent checkout.
if (existsSync(resolve(root, '.git'))) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const manifest = {
    schemaVersion: 1, repository: REPOSITORY,
    gitSha: git('rev-parse', 'HEAD'), gitTree: git('rev-parse', 'HEAD^{tree}'),
    commitTime: git('show', '-s', '--format=%cI', 'HEAD'),
    runId: process.env.GITHUB_RUN_ID ?? '0',
  };
  if (process.env.GITHUB_SHA) invariant(manifest.gitSha === process.env.GITHUB_SHA, 'Checkout differs from workflow SHA');
  assertManifest(manifest);
  writeFileSync(destination, JSON.stringify(manifest, null, 2) + '\n');
} else {
  assertManifest(JSON.parse(readFileSync(destination, 'utf8')));
}
