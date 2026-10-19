"""Classify CI proof for a source review without bypassing protected PR checks.

A newly reviewed source tree can initially fail *only* the source-attestation check,
creating a controlled bootstrap cycle: five quality jobs PASS, independent review,
append-only approval, and then all SIX PR checks must PASS before any merge.
"""

REQUIRED_QUALITY = ('verify', 'security', 'firestore', 'identity-roles', 'browser')


def verify_quality_for_review(run: dict, jobs: list[dict], commit: str) -> dict:
    if run.get('head_sha') != commit or run.get('event') != 'pull_request':
        raise ValueError('Source review CI must come from the exact PR head commit')
    by_name: dict[str, list[dict]] = {}
    for job in jobs:
        by_name.setdefault(job.get('name', ''), []).append(job)
    for name in REQUIRED_QUALITY:
        matches = by_name.get(name, [])
        if len(matches) != 1 or matches[0].get('conclusion') != 'success':
            raise ValueError(f'Required quality check was not successful: {name}')
    if run.get('conclusion') == 'success':
        # A green run cannot contain any hidden failure, even an unrequired job.
        if any(job.get('conclusion') not in ('success', 'skipped') for job in jobs):
            raise ValueError('A reportedly green run contains an unsuccessful job')
        return {'quality': 'PASS', 'releaseReadiness': 'PASS_OR_PRE_GATE', 'overall': 'success'}
    if run.get('conclusion') != 'failure':
        raise ValueError('Review CI run is not complete')
    readiness = by_name.get('release-readiness', [])
    if len(readiness) != 1 or readiness[0].get('conclusion') != 'failure':
        raise ValueError('Only the new source-bound attestation check may block review bootstrap')
    for job in jobs:
        if job.get('name') == 'release-readiness':
            continue
        if job.get('conclusion') == 'success':
            continue
        # The PR-only deployment job has no reason to run; no other unverified
        # jobs can count as independent code-quality proof.
        if job.get('name') == 'deploy' and job.get('conclusion') == 'skipped':
            continue
        raise ValueError(f'Unexpected unsuccessful job during review bootstrap: {job.get("name")}')
    return {'quality': 'PASS', 'releaseReadiness': 'BLOCKED_AWAITING_REVIEW', 'overall': 'failure'}
