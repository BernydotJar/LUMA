import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { assertManifest, invariant } from './policy.mjs';
import './manifest.mjs';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(process.env.RELEASE_DIR ?? resolve(tmpdir(), 'luma-release'));
mkdirSync(out, { recursive: true });
const manifest = assertManifest(JSON.parse(readFileSync(resolve(root, 'src/generated/release-manifest.json'), 'utf8')), process.env.GITHUB_SHA);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const changed = git('diff', '--name-only', manifest.gitSha).trim().split('\n').filter(Boolean).filter(path => path !== 'src/generated/release-manifest.json');
invariant(changed.length === 0, `Tested checkout differs from archived commit: ${changed.join(', ')}`);
// Upload committed application roots, not credentials or historical reports.
const roots = ['package.json', 'package-lock.json', 'apphosting.yaml', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs', 'src', 'public', 'scripts'];
const files = git('ls-tree', '-r', '--name-only', manifest.gitSha, '--', ...roots).trim().split('\n');
for (const file of files) invariant(!/(^|\/)(\.env(?:\.|$)|gha-creds-|.*\.(pem|p12|pfx|key)$)/i.test(file), `Forbidden release file: ${file}`);
const staging = mkdtempSync(resolve(tmpdir(), 'luma-source-'));
try {
  const tar = resolve(out, 'source.tar');
  execFileSync('git', ['archive', '--format=tar', `--output=${tar}`, manifest.gitSha, '--', ...roots], { cwd: root });
  execFileSync('tar', ['-xf', tar, '-C', staging]);
  copyFileSync(resolve(root, 'src/generated/release-manifest.json'), resolve(staging, 'src/generated/release-manifest.json'));
  const archive = resolve(out, 'source.zip');
  rmSync(archive, { force: true });
  execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: staging });
  rmSync(tar);
  const archiveSha256 = createHash('sha256').update(readFileSync(archive)).digest('hex');
  writeFileSync(resolve(out, 'manifest.json'), JSON.stringify({ ...manifest, archiveSha256 }, null, 2) + '\n');
  console.log(`Prepared ${manifest.gitSha}: sha256:${archiveSha256}`);
} finally { rmSync(staging, { recursive: true, force: true }); }
