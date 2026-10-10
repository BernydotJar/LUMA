export const PROJECT = 'luma-learning-intelligence';
export const PROJECT_NUMBER = '161313706596';
export const REGION = 'us-central1';
export const BACKEND = 'luma';
export const REPOSITORY = 'BernydotJar/LUMA';
export const PRODUCTION_URL = 'https://luma--luma-learning-intelligence.us-central1.hosted.app';
export const PARENT = `projects/${PROJECT}/locations/${REGION}/backends/${BACKEND}`;
export const SOURCE_BUCKET = `firebaseapphosting-sources-${PROJECT_NUMBER}-${REGION}`;
export const REQUIRED_CHECKS = ['verify', 'security', 'firestore', 'identity-roles', 'browser'];
export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
export function assertManifest(manifest, sha) {
  invariant(manifest?.schemaVersion === 1, 'Invalid release manifest schema');
  invariant(manifest.repository === REPOSITORY, 'Unexpected repository');
  for (const field of ['gitSha', 'gitTree']) invariant(/^[a-f0-9]{40}$/.test(manifest[field] ?? ''), `Invalid ${field}`);
  invariant(!sha || manifest.gitSha === sha, 'Release SHA does not match verified commit');
  invariant(/^\d+$/.test(manifest.runId ?? ''), 'Invalid run ID');
  invariant(Number.isFinite(Date.parse(manifest.commitTime)), 'Invalid commit time');
  return manifest;
}
export function assertDeployContext(env, manifest) {
  assertManifest(manifest, env.GITHUB_SHA);
  invariant(env.GITHUB_ACTIONS === 'true', 'Promotion must run through GitHub Actions');
  invariant(env.GITHUB_REPOSITORY === REPOSITORY, 'Unexpected workflow repository');
  invariant(env.GITHUB_EVENT_NAME === 'push', 'Only validated main push runs can promote');
  invariant(env.GITHUB_REF === 'refs/heads/main', 'Only main can promote');
  invariant(manifest.runId === env.GITHUB_RUN_ID, 'Artifact belongs to another run');
}
export function assertQualityJobs(jobs) {
  for (const name of REQUIRED_CHECKS) {
    const matches = jobs.filter(job => job.name === name);
    invariant(matches.length === 1 && matches[0].conclusion === 'success', `Required check not successful: ${name}`);
  }
}
export function buildIdFromName(name) {
  const match = /^projects\/(?:luma-learning-intelligence|161313706596)\/locations\/us-central1\/backends\/luma\/builds\/([a-z0-9-]+)$/.exec(name ?? '');
  invariant(match, 'Build is outside the approved production backend');
  return match[1];
}
export function singleServingBuild(traffic) {
  invariant(!traffic.reconciling, 'Traffic is still reconciling');
  const splits = traffic.current?.splits;
  invariant(splits?.length === 1 && splits[0].percent === 100, 'Expected one build serving 100% traffic');
  return buildIdFromName(splits[0].build);
}
