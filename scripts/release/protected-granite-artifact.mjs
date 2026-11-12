/** Authenticated GitHub artifact downloader used from the protected signer only.
 * Verifies the registry workflow ID, artifact provenance and zip SHA-256.
 * Never executes candidate code, unpacked files or model-generated instructions.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateProtectedGraniteProvenance } from './model-review-contract.mjs';
import { invariant } from './policy.mjs';

const REPO = 'BernydotJar/LUMA';
const SHA256 = /^[a-f0-9]{64}$/;
const gh = route => JSON.parse(execFileSync('gh',['api',route],{
  encoding:'utf8',timeout:30000,maxBuffer:12*1024*1024 }));

export function selectProtectedArtifact(artifacts,runId,prNumber) {
  invariant(Number.isSafeInteger(runId) && Number.isSafeInteger(prNumber),
    'Protected artifact needs real run and PR IDs');
  const name=`granite-protected-${prNumber}-${runId}`;
  const found=(artifacts ?? []).filter(row=>row.name===name &&
    row.workflow_run?.id===runId && row.expired===false &&
    Number.isSafeInteger(row.id) && row.id>0 &&
    /^sha256:[a-f0-9]{64}$/.test(row.digest ?? '') &&
    row.size_in_bytes>50 && row.size_in_bytes<6*1024*1024);
  invariant(found.length===1,'Protected review artifact missing, duplicate, expired or untrusted');
  return found[0];
}

export async function obtainProtectedGraniteReview({ prNumber, reviewedCommit,
  sourceDigest, trustedModelDigest }) {
  invariant(/^\d+$/.test(String(prNumber)) && /^[a-f0-9]{40}$/.test(reviewedCommit ?? '') &&
    SHA256.test(sourceDigest ?? '') && SHA256.test(trustedModelDigest ?? ''),
    'Invalid candidate/model inputs for authenticated reviewer');
  const workflow=gh(`repos/${REPO}/actions/workflows/granite-protected-review.yml`);
  invariant(Number.isSafeInteger(workflow.id) && workflow.path==='.github/workflows/granite-protected-review.yml' &&
    workflow.state==='active', 'Protected model reviewer is not registered on main');
  // Candidate requests an exact run ID; signed approval cannot infer a run from a label.
  const runId=Number(process.env.LUMA_GRANITE_REVIEW_RUN_ID);
  invariant(Number.isSafeInteger(runId) && runId>0, 'Owner must select the exact protected review run ID');
  const run=gh(`repos/${REPO}/actions/runs/${runId}`);
  const jobs=gh(`repos/${REPO}/actions/runs/${runId}/jobs?filter=latest&per_page=100`).jobs;
  const candidates=gh(`repos/${REPO}/actions/runs/${runId}/artifacts?per_page=100`).artifacts;
  const artifact=selectProtectedArtifact(candidates,runId,Number(prNumber));
  const token=process.env.GH_TOKEN;
  invariant(typeof token==='string'&&token.length>10,'GitHub token required for protected review retrieval');
  const result=await fetch(`https://api.github.com/repos/${REPO}/actions/artifacts/${artifact.id}/zip`,{
    headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'},redirect:'follow',signal:AbortSignal.timeout(45000),
  });
  invariant(result.ok,'Authenticated GitHub artifact download failed');
  const bytes=Buffer.from(await result.arrayBuffer());
  invariant(bytes.length>50 && bytes.length<6*1024*1024,
    'Unexpected trusted model artifact size');
  const actual=createHash('sha256').update(bytes).digest('hex');
  invariant(`sha256:${actual}`===artifact.digest,
    'Downloaded review artifact differs from GitHub-authenticated ZIP digest');
  const dir=mkdtempSync(join(tmpdir(),'luma-granite-artifact-'));
  let report;
  try {
    const zip=join(dir,'review.zip');
    writeFileSync(zip,bytes);
    const json=execFileSync('unzip',['-p',zip,'granite-review.json'],{
      encoding:'utf8',timeout:20000,maxBuffer:5*1024*1024});
    report=JSON.parse(json);
  } finally {rmSync(dir,{recursive:true,force:true});}
  const prov=validateProtectedGraniteProvenance({run,jobs,
    artifactSource:{kind:'github-actions-artifact',workflowRunId:runId,
      fromAuthenticatedGitHubApi:true,artifactDigestSha256:actual,evidence:report},
    expectedWorkflowId:workflow.id,expectedSourceSha:reviewedCommit,
    expectedSourceDigest:sourceDigest,trustedModelDigest,
    expectedTrustedWorkflowCommit:process.env.GITHUB_SHA});
  invariant(['public-landing','owner-risk-exception-required'].includes(report.riskClassification),
    'Model risk classification is missing');
  return {provenance:prov,report,run,jobs,artifact,workflow};
}
