/** Runs ONLY from a protected-main workflow_dispatch with a main-only environment.
 * It reads PR files as inert data and checks GitHub's independent reviewer identity.
 * No candidate JS, shell, npm scripts or approval self-claims are executed. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { reviewedSourceDigest, verifyReview } from './review-gate.mjs';
import { signApproval, verifyApprovalSignature } from './approval-signature.mjs';
import { invariant } from './policy.mjs';
import { receiptCommentBody } from './remote-attestation.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const REPO = 'BernydotJar/LUMA';
// A candidate must satisfy all jobs declared by the authenticated protected
// main workflow. Extra candidate jobs must also succeed or skip as specified.
const CORE_TECHNICAL=['verify','security','firestore','identity-roles','browser'];
const PRODUCTION_ONLY=new Set(['product-acceptance-predeploy','deploy',
  'postdeploy-acceptance','rollback-on-failed-acceptance']);
function gh(path) {
  return JSON.parse(execFileSync('gh', ['api',path], { encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024 }));
}
export function ghPages(path) {
  // GitHub CLI versions that do not implement `--slurp` still expose a stable
  // JSON array for each explicit page. Never silently truncate review history.
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const suffix = path.includes('?') ? '&' : '?';
    const rows = gh(`${path}${suffix}page=${page}`);
    invariant(Array.isArray(rows), 'GitHub review pagination returned a non-array response');
    all.push(...rows);
    if (rows.length < 100) return all;
  }
  throw new Error('GitHub reviewer history exceeds safe pagination limit');
}
const git = (directory,...args) => execFileSync('git',args,{cwd:directory,encoding:'utf8',timeout:15000}).trim();
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');

export function authenticateExternalCodexReview(comments,sourceCommit) {
  const verified = comments.filter(comment =>
    comment.user?.login === 'chatgpt-codex-connector[bot]' &&
    comment.body?.includes('<!-- codex-review-state:v1 '));
  const current = verified.flatMap(comment => {
    try {
      const match = comment.body.match(/<!-- codex-review-state:v1 (\{[^\n]*\}) -->/);
      if (!match) return [];
      const receipt = JSON.parse(match[1]);
      return receipt.code_review?.commit_sha === sourceCommit ? [
        { ...receipt.code_review, publishedAt: comment.updated_at ?? comment.created_at ?? '' },
      ] : [];
    } catch { return []; }
  }).sort((a,b) => a.publishedAt.localeCompare(b.publishedAt));
  const latest = current.at(-1);
  invariant(latest?.status === 'completed' && latest.has_any_findings === false &&
    latest.has_unresolved_findings === false,
    'Latest independent Codex review for exact source commit is missing or has findings');
  return true;
}

/** Alternate independent reviewer when the GitHub Codex integration is rate-limited.
 * Only GitHub's authenticated review API and an administrator-maintained
 * allowlist can authorize this path. Candidate-authored approval JSON cannot.
 */
export function authenticateTrustedHumanReview(reviews, sourceCommit, prAuthor, reviewerAllowlist,
    candidateContributors = []) {
  invariant(/^[a-f0-9]{40}$/.test(sourceCommit), 'Human approval requires exact full source SHA');
  invariant(typeof prAuthor === 'string' && prAuthor.length > 0, 'PR author must be known');
  const trusted = new Set(String(reviewerAllowlist ?? '').split(/[\n,]/)
    .map(login => login.trim().toLowerCase())
    .filter(login => /^[a-z0-9](?:[a-z0-9-]{0,37})$/.test(login)));
  invariant(trusted.size > 0, 'No independently authorized reviewer logins configured');
  const contributors = new Set([prAuthor, ...candidateContributors]
    .filter(value => typeof value === 'string').map(value => value.toLowerCase()));
  const reviewers = new Map();
  for (const review of reviews) {
    const login = review.user?.login?.toLowerCase();
    if (!login || contributors.has(login) || !trusted.has(login) ||
      review.user?.type !== 'User' || !Number.isSafeInteger(review.id) || review.id <= 0 ||
      !['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) continue;
    const existing = reviewers.get(login);
    const stamp = typeof review.submitted_at === 'string' ? review.submitted_at : '';
    if (!existing || stamp > existing.stamp || stamp === existing.stamp && review.id > existing.id) {
      reviewers.set(login, { ...review, stamp });
    }
  }
  // A second allowlisted reviewer requesting changes at this SHA must veto
  // an approval from another person until the concern is addressed.
  invariant(![...reviewers.values()].some(review =>
    review.state === 'CHANGES_REQUESTED' && review.commit_id === sourceCommit),
    'An independent authorized reviewer has outstanding requested changes');
  const approved = [...reviewers.values()].find(review =>
    review.state === 'APPROVED' && review.commit_id === sourceCommit &&
    Boolean(review.submitted_at));
  invariant(approved, 'An allowlisted independent human must approve the exact source SHA in GitHub');
  return { method: 'github-human-approval', reviewer: approved.user.login, reviewId: approved.id };
}

/** A completed Codex review with findings is a hard stop, never a human override.
 * If Codex fails due to quota/unavailability, a trusted external reviewer can
 * supply an actual GitHub APPROVED review on the final source commit instead.
 */
export function authenticateIndependentSourceReview(comments, reviews, sourceCommit, prAuthor,
    reviewerAllowlist, candidateContributors = []) {
  // Even a clean Codex result must not override outstanding change requests
  // from an independently authorized human on the same exact source SHA.
  const trusted = new Set(String(reviewerAllowlist ?? '').split(/[\n,]/)
    .map(login => login.trim().toLowerCase()).filter(Boolean));
  const contributors = new Set([prAuthor, ...candidateContributors]
    .filter(Boolean).map(value => value.toLowerCase()));
  const decisive = new Map();
  for (const review of reviews) {
    const login = review.user?.login?.toLowerCase();
    if (!trusted.has(login) || contributors.has(login) || review.user?.type !== 'User' ||
        review.commit_id !== sourceCommit ||
        !['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(review.state)) continue;
    const previous = decisive.get(login);
    const at = review.submitted_at ?? '';
    if (!previous || at > previous.at || at === previous.at && review.id > previous.id) {
      decisive.set(login, { state: review.state, at, id: review.id });
    }
  }
  invariant(![...decisive.values()].some(review => review.state === 'CHANGES_REQUESTED'),
    'Independent human requested changes on reviewed source SHA; Codex cannot override');
  const latest = comments.filter(comment => comment.user?.login === 'chatgpt-codex-connector[bot]')
    .flatMap(comment => {
      const match = comment.body?.match(/<!-- codex-review-state:v1 (\{[^\n]*\}) -->/);
      if (!match) return [];
      try {
        const state = JSON.parse(match[1]).code_review;
        return state?.commit_sha === sourceCommit
          ? [{ ...state, postedAt: comment.updated_at ?? comment.created_at ?? '',
              reviewId: comment.id }] : [];
      } catch { return []; }
    }).sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1);
  if (latest?.status === 'completed') {
    invariant(latest.has_any_findings === false && latest.has_unresolved_findings === false,
      'Completed independent Codex review has unresolved or undisposed findings');
    invariant(Number.isSafeInteger(latest.reviewId) && latest.reviewId > 0,
      'GitHub Codex receipt is missing its authenticated issue-comment ID');
    return { method: 'github-codex-clean-review', reviewer: 'chatgpt-codex-connector[bot]',
      reviewId: latest.reviewId };
  }
  invariant(!latest || latest.status === 'failed',
    'Independent Codex review is still running; wait for a final result');
  return authenticateTrustedHumanReview(reviews, sourceCommit, prAuthor, reviewerAllowlist,
    candidateContributors);
}

/** Never sign a newer PR head using an ancestor's CI or review. */
export function requireExactReviewedHead(testedCommit, candidateHead, prHead) {
  invariant(/^[a-f0-9]{40}$/.test(testedCommit) && /^[a-f0-9]{40}$/.test(candidateHead) &&
    testedCommit === candidateHead && candidateHead === prHead,
    'Independent approval requires exact matching PR HEAD, tested commit and reviewed source');
  return true;
}

export function protectedQualityJobNames(yaml) {
  invariant(typeof yaml==='string'&&yaml.length>100&&yaml.length<150000,
    'Missing protected main quality workflow definition');
  const jobs=[];
  let inJobs=false;
  for(const line of yaml.split(/\r?\n/)){
    if(!inJobs){if(/^jobs:\s*(?:#.*)?$/.test(line))inJobs=true;continue;}
    if(/^[A-Za-z][\w-]*:/.test(line))break;
    const start=line.match(/^  ([a-z][a-z0-9-]*):\s*(?:#.*)?$/);
    if(start){jobs.push({id:start[1],name:start[1]});continue;}
    if(!jobs.length)continue;
    const explicit=line.match(/^    name:\s*(.+?)\s*$/);
    if(explicit){
      let name=explicit[1].replace(/\s+#.*$/,'').trim();
      if(name.startsWith('"')&&name.endsWith('"')||
        name.startsWith("'")&&name.endsWith("'"))name=name.slice(1,-1);
      invariant(name.length>0&&name.length<100&&!name.includes(String.fromCharCode(36)+'{'),
        'Protected workflow job name must be a static literal');
      jobs.at(-1).name=name;
    }
  }
  const result=jobs.map(job=>job.name);
  invariant(inJobs && result.length>=7&&result.length===new Set(result).size&&
    CORE_TECHNICAL.every(name=>result.includes(name))&&
    result.includes('release-readiness')&&result.includes('deploy'),
    'Protected main workflow is missing mandatory QA/release jobs');
  return result;
}
/** Reject a candidate's attempt to replace protected technical CI steps with
 * success-only stubs. Protected main workflow source is fetched by exact SHA.
 */
/** Authentication of the workflow execution policy must cover *all*
 * protected jobs and global YAML controls, not only the five core steps.
 */
export function assertProtectedQualityCore(mainYaml,candidateYaml){
  invariant(typeof mainYaml==='string'&&typeof candidateYaml==='string',
    'Protected quality workflow source must be present');
  function globalBlocks(source){
    const blocks=new Map();
    let key=null,buffer=[],prologue=[];
    for(const line of source.split(/\r?\n/)){
      // Match quoted and otherwise unusual YAML root keys: ignoring an
      // unrecognized root property can bypass workflow-wide run controls.
      const found=line.match(/^([^\s#][^:]*):(?:\s.*)?$/);
      if(found){
        if(key!==null)blocks.set(key,buffer.join('\n').trimEnd());
        key=found[1];
        invariant(!blocks.has(key),'Duplicate top-level quality workflow key: '+key);
        buffer=[line];
      }else if(key!==null){
        buffer.push(line);
      }else{
        // Fail closed for alternative YAML document/key syntax preceding
        // the first standard mapping key; exact matching includes comments.
        prologue.push(line);
      }
    }
    if(key!==null)blocks.set(key,buffer.join('\n').trimEnd());
    blocks.set('__preamble__',prologue.join('\n').trimEnd());
    invariant(blocks.has('jobs')&&blocks.has('on')&&blocks.has('permissions'),
      'Missing protected workflow-wide execution controls');
    return blocks;
  }
  const protectedGlobal=globalBlocks(mainYaml), candidateGlobal=globalBlocks(candidateYaml);
  invariant(protectedGlobal.size===candidateGlobal.size &&
    [...protectedGlobal].every(([key,value])=>
      key==='jobs'||candidateGlobal.get(key)===value),
    'Untrusted candidate altered workflow-wide execution controls');
  const protectedJobsSection=protectedGlobal.get('jobs');
  const candidateJobsSection=candidateGlobal.get('jobs');
  function job(source,name){
    const lines=source.split(/\r?\n/);
    const start=lines.findIndex(line=>line==='  '+name+':');
    invariant(start>=0,'Required protected job missing: '+name);
    let end=start+1;
    while(end<lines.length&&!/^  [a-z][a-z0-9-]*:\s*(?:#.*)?$/.test(lines[end]))end++;
    return lines.slice(start,end).join('\n').trimEnd();
  }
  const protectedIds=[...protectedJobsSection.matchAll(/^  ([a-z][a-z0-9-]*):\s*(?:#.*)?$/gm)]
    .map(match=>match[1]);
  invariant(protectedIds.length>=7 && protectedIds.length===new Set(protectedIds).size,
    'Protected main technical job inventory invalid');
  for(const id of protectedIds){
    const before=job(protectedJobsSection,id);
    let after=job(candidateJobsSection,id);
    if(before!==after && (id==='release-readiness'||id==='deploy')){
      // Exactly sanctioned policy migration additions. A changed validation
      // step or deployment command remains forbidden.
      if(id==='release-readiness'){
        const withGate='    needs: [verify, security, firestore, identity-roles, browser, attestation-contract]';
        invariant(after.includes(withGate),'Attestation contract must gate release-readiness');
        after=after.replace(withGate,'    needs: [verify, security, firestore, identity-roles, browser]');
      }
      const additions=[
        '      issues: read\n','      pull-requests: read\n',
        '          LUMA_RELEASE_TRUSTED_REVIEWERS: DOLLAR{{ vars.LUMA_RELEASE_TRUSTED_REVIEWERS }}\n',
      ].map(line=>line.replace('DOLLAR','$'));
      if(id==='release-readiness')additions.push(
        '          GH_TOKEN: DOLLAR{{ github.token }}\n'.replace('DOLLAR','$'));
      if(id==='deploy')additions.push(
        '          LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64: DOLLAR{{ vars.LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64 }}\n'
          .replace('DOLLAR','$'));
      for(const line of additions){
        invariant(after.includes(line),'Expected exact protected governance migration addition missing: '+id);
        after=after.replace(line,'');
      }
    }
    invariant(before===after,
      'Untrusted candidate altered protected job definition: '+id);
  }
  return true;
}
export function assertQualityRunPr(run,prNumber,commit,policySha){
  invariant(Number.isSafeInteger(prNumber)&&prNumber>0&&
    /^[a-f0-9]{40}$/.test(policySha||'')&&
    run.pull_requests?.some(pr=>pr.number===prNumber&&pr.head?.sha===commit&&
      pr.base?.ref==='main'&&pr.base?.sha===policySha),
    'Quality run does not belong to exact protected-main pull request');
  return true;
}
export function validateQualityRun(run,jobs,commit,registeredWorkflowId,protectedJobs,prNumber,policySha) {
  invariant(Number.isSafeInteger(registeredWorkflowId)&&registeredWorkflowId>0&&
    run.workflow_id===registeredWorkflowId&&run.path==='.github/workflows/quality.yml'&&
    run.repository?.full_name===REPO&&run.head_repository?.full_name===REPO&&
    run.head_sha===commit&&run.event==='pull_request'&&
    ['failure','success'].includes(run.conclusion),
    'CI must use registered Product quality workflow on exact reviewed PR HEAD');
  assertQualityRunPr(run,prNumber,commit,policySha);
  invariant(Array.isArray(protectedJobs)&&protectedJobs.length>=7&&
    protectedJobs.length===new Set(protectedJobs).size&&
    CORE_TECHNICAL.every(name=>protectedJobs.includes(name))&&
    protectedJobs.includes('release-readiness')&&protectedJobs.includes('deploy'),
    'Trusted main expected job contract is invalid');
  const observed=new Map();
  for(const job of jobs){
    invariant(typeof job?.name==='string'&&!observed.has(job.name),
      'Duplicate or unnamed quality job in authenticated CI');
    observed.set(job.name,job);
  }
  for(const name of protectedJobs)
    invariant(observed.has(name),'Required protected-main quality job missing: '+name);
  for(const [name,job] of observed){
    if(name==='release-readiness'){
      invariant(['failure','success'].includes(job.conclusion),
        'Release-readiness has no explicit result');
    }else if(PRODUCTION_ONLY.has(name)){
      invariant(job.conclusion==='skipped',
        'Production-only job must be skipped on PR: '+name);
    }else{
      invariant(job.conclusion==='success','Technical quality job not approved: '+name);
    }
  }
  return true;
}
function protectedWorkflowJobsAtMain(policySha){
  invariant(/^[a-f0-9]{40}$/.test(policySha),'Trusted policy SHA is invalid');
  const source=gh('repos/'+REPO+'/contents/.github/workflows/quality.yml?ref='+policySha);
  invariant(source.type==='file'&&source.encoding==='base64'&&
    typeof source.content==='string','Protected main workflow fetch failed');
  const yaml=Buffer.from(source.content,'base64').toString('utf8');
  return {names:protectedQualityJobNames(yaml),yaml};
}

/** Exact source and successful technical jobs are obtained from GitHub,
 * never from a PR-controlled claim about its own commit ID.
 */
export function buildUnsignedProtectedApproval(template,source,head,run,criticSha,verifierSha,verifier,review,policySha){
  invariant(/^[a-f0-9]{64}$/.test(source)&&/^[a-f0-9]{40}$/.test(head) &&
    /^[a-f0-9]{40}$/.test(policySha||''),
    'Signer must derive source, PR head and trusted policy SHA from GitHub');
  invariant(Number.isSafeInteger(run?.id)&&run.id>0 &&
    /^[a-f0-9]{64}$/.test(criticSha)&&/^[a-f0-9]{64}$/.test(verifierSha),
    'Verified quality run and adversarial evidence are mandatory');
  invariant(verifier?.status==='PASS' && verifier.unresolvedCritical===0 &&
    verifier.unresolvedHigh===0,'Independent verifier cannot certify unresolved defects');
  invariant(/^[a-f0-9]{64}$/.test(template?.graphEventHash||'') &&
    typeof template.graphEventId==='string' && template.graphEventId.length>0,
    'Current independently generated Graph evidence is required');
  return {
    schemaVersion:3,status:'PASS',policySha,sourceDigest:source,testedCommit:head,
    ciRunId:String(run.id),graphEventId:template.graphEventId,
    graphEventHash:template.graphEventHash,
    critic:{sha256:criticSha},verifier:{sha256:verifierSha},
    unresolvedCritical:0,unresolvedHigh:0,
    review:{...review,commitSha:head},
  };
}
function findExactSuccessfulQualityRun(head,workflowId,protectedJobs,prNumber,policySha) {
  const runs=[];
  for(let page=1;page<=30;page++){
    const discovered=gh('repos/'+REPO+'/actions/workflows/quality.yml/runs?event=pull_request&head_sha='+head+
      '&per_page=100&page='+page);
    const pageRuns=discovered.workflow_runs??[];
    invariant(Array.isArray(pageRuns),'GitHub workflow runs pagination unavailable');
    runs.push(...pageRuns);
    if(pageRuns.length<100)break;
    invariant(page<30,'Exact-head quality history exceeds safe pagination limit');
  }
  const matching=runs.filter(run=>run.head_sha===head&&run.status==='completed'&&
    run.workflow_id===workflowId&&run.path==='.github/workflows/quality.yml')
    .sort((a,b)=>b.id-a.id);
  for(const run of matching){
    const jobs=gh('repos/'+REPO+'/actions/runs/'+run.id+'/jobs?filter=latest&per_page=100').jobs;
    try {
      validateQualityRun(run,jobs,head,workflowId,protectedJobs,prNumber,policySha);
      return run;
    }catch(error){ console.error('QUALITY_RUN_REJECTED',run.id,error.message); }
  }
  throw Error('No authentic technical quality run covers the exact reviewed head');
}
/** Only re-run the exact protected GitHub-authenticated checks for the
 * signed PR head. This is not a status bypass or a self-approved review.
 */
export function selectAuthenticSourceCheckRun(runs,workflowId,prNumber,head,mainSha){
  invariant(/^[a-f0-9]{40}$/.test(mainSha||''),'Main policy SHA is required');
  const matches=runs.filter(run=>run.workflow_id===workflowId &&
    run.path==='.github/workflows/source-attestation.yml' &&
    run.status==='completed' &&
    ['pull_request_target','pull_request_review'].includes(run.event) &&
    // REST workflow-run head may report candidate SHA or the protected base.
    // The authenticated PR object must always identify exact head and base.
    (run.head_sha===head ||
      run.event==='pull_request_target' && run.head_sha===mainSha) &&
    run.pull_requests?.some(pr=>pr.number===prNumber && pr.head?.sha===head &&
      pr.base?.ref==='main' && pr.base?.sha===mainSha));
  invariant(matches.length>0,'No exact-head protected source-attestation run to rerun');
  return matches.sort((a,b)=>b.id-a.id)[0];
}
function queueSourceAndQualityRechecks(prNumber,head,qualityRunId){
  const meta=gh('repos/'+REPO+'/actions/workflows/source-attestation.yml');
  const gathered=[];
  for(let page=1;page<=30;page++){
    const list=gh('repos/'+REPO+
      '/actions/workflows/source-attestation.yml/runs?per_page=100&page='+page);
    const rows=list.workflow_runs??[];
    invariant(Array.isArray(rows),'Source-attestation history is unavailable');
    gathered.push(...rows);
    if(rows.length<100)break;
    invariant(page<30,'Source-attestation run history exceeds bounded pagination');
  }
  const main=gh('repos/'+REPO+'/git/ref/heads/main').object.sha;
  const source=selectAuthenticSourceCheckRun(gathered,
    meta.id,prNumber,head,main);
  if(source.conclusion==='failure'){
    execFileSync('gh',['api','-X','POST','repos/'+REPO+
      '/actions/runs/'+source.id+'/rerun-failed-jobs'],
      {encoding:'utf8',timeout:20000});
  }else invariant(source.conclusion==='success',
    'Protected source-attestation has an indeterminate conclusion');
  execFileSync('gh',['api','-X','POST','repos/'+REPO+
    '/actions/runs/'+qualityRunId+'/rerun-failed-jobs'],
    {encoding:'utf8',timeout:20000});
  return {sourceRunId:source.id,qualityRunId};
}
async function main() {
  invariant(process.env.GITHUB_REF==='refs/heads/main'&&process.env.GITHUB_REPOSITORY===REPO &&
    process.env.GITHUB_EVENT_NAME==='workflow_dispatch',
    'Only a protected main workflow_dispatch may issue independent signatures');
  const [candidate,prArg]=process.argv.slice(2);
  invariant(candidate && /^[0-9]+$/.test(prArg??'')&&Number(prArg)>0,
    'Protected signer requires candidate checkout and authorized PR number');
  const directory=resolve(candidate);
  const template=JSON.parse(readFileSync(resolve(directory,
    'evidence/cicd-enterprise/release-approval.json'),'utf8'));
  invariant(!template.signature,'Untrusted PR approval may not carry a private signature');
  const head=git(directory,'rev-parse','HEAD');
  const pr=gh('repos/'+REPO+'/pulls/'+prArg);
  requireExactReviewedHead(head,head,pr.head?.sha);
  invariant(pr.base?.ref==='main'&&pr.state==='open'&&!pr.merged &&
    pr.head?.repo?.full_name===REPO,
    'Protected signer refuses an unrelated, closed or cross-repository PR');
  const mainHead=gh('repos/'+REPO+'/git/ref/heads/main').object.sha;
  invariant(mainHead===process.env.GITHUB_SHA,
    'Protected signer policy changed after workflow dispatch; refuse stale policy');
  const source=reviewedSourceDigest(directory);
  const workflow=gh('repos/'+REPO+'/actions/workflows/quality.yml');
  const protectedQuality=protectedWorkflowJobsAtMain(mainHead);
  const candidateQuality=readFileSync(resolve(directory,'.github/workflows/quality.yml'),'utf8');
  assertProtectedQualityCore(protectedQuality.yaml,candidateQuality);
  const run=findExactSuccessfulQualityRun(head,workflow.id,
    protectedQuality.names,Number(prArg),mainHead);
  const comments=ghPages('repos/'+REPO+'/issues/'+prArg+'/comments?per_page=100');
  const reviews=ghPages('repos/'+REPO+'/pulls/'+prArg+'/reviews?per_page=100');
  const commits=ghPages('repos/'+REPO+'/pulls/'+prArg+'/commits?per_page=100');
  const contributors=commits.flatMap(commit=>
    [commit.author?.login,commit.committer?.login].filter(Boolean));
  const independent=authenticateIndependentSourceReview(comments,reviews,head,
    pr.user?.login,process.env.LUMA_RELEASE_TRUSTED_REVIEWERS,contributors);
  const criticPath=resolve(directory,'evidence/cicd-enterprise/granite-review.json');
  const verifierPath=resolve(directory,'evidence/cicd-enterprise/independent-review.json');
  const criticSha=sha(criticPath),verifierSha=sha(verifierPath);
  const critic=JSON.parse(readFileSync(criticPath,'utf8'));
  const verifier=JSON.parse(readFileSync(verifierPath,'utf8'));
  invariant(critic.complete===true&&critic.reviewedSourceDigest===source&&
    verifier.status==='PASS'&&verifier.reviewedSourceDigest===source &&
    verifier.unresolvedCritical===0&&verifier.unresolvedHigh===0,
    'Current source does not have independent critic and verifier approval');
  const dispositions=new Map((verifier.dispositions??[]).map(item=>[item.id,item]));
  for(const finding of critic.evaluation?.findings??[]){
    if(['critical','high'].includes(finding.severity)){
      const decision=dispositions.get(finding.id);
      invariant(decision&&['resolved','false-positive'].includes(decision.status)&&
        Array.isArray(decision.evidence)&&decision.evidence.length>0,
        'Unresolved independent adversarial finding: '+finding.id);
    }
  }
  // The candidate can supply Graph references and unsigned evidence, but no
  // source SHA, CI-run ID, approval identity or signature is trusted from it.
  const unsigned=buildUnsignedProtectedApproval(template,source,head,run,
    criticSha,verifierSha,verifier,independent,mainHead);
  const signed=signApproval(unsigned,process.env.LUMA_RELEASE_ATTESTATION_PRIVATE_KEY_B64);
  verifyApprovalSignature(signed,process.env.LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64);
  verifyReview(directory,{approval:signed}); // Authenticates append-only Graph history.
  writeFileSync(resolve(ROOT,'release-approval-signed.json'),
    JSON.stringify(signed,null,2)+'\n');
  // Publish the receipt to a GitHub-owned channel, never modify the candidate
  // checkout or create a self-referential commit. Public key verifies contents.
  invariant(gh('repos/'+REPO+'/git/ref/heads/main').object.sha===mainHead,
    'Protected policy changed after verification and before receipt publication');
  const body=receiptCommentBody(Number(prArg),signed);
  const published=JSON.parse(execFileSync('gh',['api','-X','POST',
    'repos/'+REPO+'/issues/'+prArg+'/comments','-f','body='+body],
    {encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024}));
  invariant(published?.user?.login==='github-actions[bot]' &&
    Number.isSafeInteger(published.id),'Protected workflow failed to publish signed receipt');
  // GitHub checks are attached to the PR HEAD by their original PR events,
  // not to the default branch as an issue_comment workflow would be.
  const rechecks=queueSourceAndQualityRechecks(Number(prArg),head,run.id);
  console.log(JSON.stringify({status:'SIGNED_EXTERNALLY',sourceDigest:source,
    sourceCommit:head,runId:run.id,receiptCommentId:published.id,
    signedArtifact:'release-approval-signed.json',prNumber:Number(prArg),rechecks}));
}

if (process.argv[1] && /trusted-attestor\.mjs$/.test(process.argv[1])) {
  main().catch(error => { console.error('INDEPENDENT_ATTESTATION_BLOCKED: '+error.message);process.exitCode=1; });
}
