#!/usr/bin/env node
/**
 * Materialize protected CI environment secrets outside the checkout.
 * Neither the trust anchors nor private/signed UAT receipts are part of a PR.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';

const root=process.env.RUNNER_TEMP;
const envFile=process.env.GITHUB_ENV;
if(!root || !isAbsolute(root) || !envFile || !isAbsolute(envFile)) {
  throw Error('ACCEPTANCE_PROTECTED_RUNNER_REQUIRED');
}
const base64Fields=[
  ['LUMA_ACCEPTANCE_TRUST_STORE_B64','LUMA_ACCEPTANCE_TRUST_STORE','trusted-keyring.json'],
  ['LUMA_ACCEPTANCE_SIGNED_RECEIPTS_B64','LUMA_ACCEPTANCE_RECEIPTS','signed-receipts.json'],
];
const out=resolve(root,'luma-protected-acceptance');
mkdirSync(out,{recursive:true,mode:0o700});
for(const [secretName,exportName,fileName] of base64Fields){
  const source=process.env[secretName];
  if(!source || !/^[a-zA-Z0-9+/]+={0,2}$/.test(source) || source.length>2_000_000) {
    throw Error('ACCEPTANCE_PROTECTED_EVIDENCE_NOT_PROVISIONED');
  }
  const bytes=Buffer.from(source,'base64');
  if(bytes.length<15 || bytes.length>1_000_000)throw Error('ACCEPTANCE_PROTECTED_INPUT_SIZE_INVALID');
  const parsed=JSON.parse(bytes.toString('utf8'));
  if(!parsed || typeof parsed!=='object' || Array.isArray(parsed))throw Error('ACCEPTANCE_PROTECTED_INPUT_INVALID');
  const file=resolve(out,fileName);
  writeFileSync(file,bytes,{mode:0o600,flag:'wx'});
  // Only the path, not its content, enters GITHUB_ENV or workflow output.
  writeFileSync(envFile,`${exportName}=${file}\n`,{flag:'a'});
}
if(readFileSync(resolve(out,'trusted-keyring.json'),'utf8').length<15)throw Error('ACCEPTANCE_KEYRING_EMPTY');
console.log('Protected acceptance evidence provisioned outside repository (paths only).');
