# LUMA Live Classroom — operational readiness, expiry and cloud acceptance

Updated: 2026-10-20. Source is stacked on PR #73. **Release state: NO-GO**.
This implementation is a supported enterprise capability in development, not a POC.
Never represent a local OSS WebRTC success or green unit suite as a published, Cloud-verified customer classroom.

## Closed by this increment

- Protected maintenance endpoint: POST `/api/internal/live-classroom/reconcile`.
- Authentication: Google-signed OIDC ID token, exact audience and exact service-account principal. No Firebase end-user token, session cookie, API key or anonymous requests are accepted.
- A Firestore transaction expires active enrollments whose `accessEndsAt` is due, preserving original merchant event IDs; the same transaction writes a deterministic, durable video-disconnect outbox for linked classroom learners.
- A worker retries refund/institutional/expiry disconnections stuck in `pending` or with an expired `processing` lease. A global Firestore lease prevents concurrent workers from claiming the same full sweep. A crashed worker releases via lease timeout; a stale worker cannot erase a newer lease.
- Processing is intentionally bounded: at most 25 due enrollments and 25 revocation jobs per run; limits and any retryable failures return HTTP 503 for Scheduler retries and alerting.
- Adds Firestore composite-index definitions for the expiry and revocation-job queries.
- Separate manually triggered LiveKit **Cloud-only** three-user WebRTC test validates camera, microphone, chat, connected-participant removal, cached-JWT replay rejection, finish-for-everyone and disabled automatic room creation. It must use a dedicated non-customer LiveKit Cloud project.
- App Hosting flag `LUMA_LIVE_CLASSROOM_ENABLED=false` is preserved, so none of this is active in production before release authorization.

## Release configuration (not performed automatically)

1. Create and approve a **dedicated LiveKit Cloud acceptance project**. Configure auto room creation disabled. Obtain project WSS URL and API key/secret. No application or payment credentials are committed to Git.
2. In GitHub Environment `livekit-acceptance`, configure protected secrets `LIVEKIT_CLOUD_TEST_URL`, `LIVEKIT_CLOUD_TEST_API_KEY`, and `LIVEKIT_CLOUD_TEST_API_SECRET`. Run workflow **LiveKit Cloud enterprise acceptance** manually after selecting the correct SHA. Record its artifact and require `PROVIDER_CLOUD_PASS`. This is *provider E2E*, not Firebase-based app E2E.
3. Provision runtime-only App Hosting secrets `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` through Secret Manager/App Hosting after approval. Inject them only into runtime, not into `NEXT_PUBLIC_*`, CI logs or source. Configure the LiveKit signed webhook URL on the **published** LUMA hostname.
4. Deploy the three Firestore composite indexes in `firestore.indexes.json` via the approved infrastructure path. Verify indexes have reached READY, not just that their JSON is committed.
5. Create a dedicated scheduler caller service account within `luma-learning-intelligence`, for example `luma-live-reconcile@luma-learning-intelligence.iam.gserviceaccount.com`. Only the App Hosting service identity needs Firestore permissions; the caller identity only authenticates the HTTPS invocation.
6. Set `LUMA_LIVE_MAINTENANCE_AUDIENCE` to the exact external HTTPS endpoint URL and `LUMA_LIVE_MAINTENANCE_PRINCIPAL` to the exact scheduler account email as App Hosting **RUNTIME** environment settings. Both settings are required (fail-closed).
7. After Cloud JWT/revocation/close and actual instructor-student UAT pass, create Cloud Scheduler (one-minute interval) with a **Google OIDC ID token**:

   ```sh
   gcloud scheduler jobs create http luma-live-classroom-reconcile \
     --project=luma-learning-intelligence \
     --location=us-central1 \
     --schedule="* * * * *" \
     --time-zone="Etc/UTC" \
     --http-method=POST \
     --uri="https://luma.lch-app.cloud/api/internal/live-classroom/reconcile" \
     --oidc-service-account-email="luma-live-reconcile@luma-learning-intelligence.iam.gserviceaccount.com" \
     --oidc-token-audience="https://luma.lch-app.cloud/api/internal/live-classroom/reconcile" \
     --attempt-deadline=90s \
     --max-retry-attempts=3
   ```

   Command is documentation only; verify hostname, Cloud Scheduler IAM, chosen location and organizational controls before running. A Cloudflare reverse proxy must preserve the original Authorization header.
8. **Only then** review an explicit release PR to enable `LUMA_LIVE_CLASSROOM_ENABLED=true` in a protected environment. Verify published SHA, not merely `main`.

## Operational SLIs and alerting

| SLI | Objective / action |
| --- | --- |
| Signed refund to media eviction | Measure elapsed seconds at the LiveKit Cloud provider; document p95 and p99 under real load |
| Expiry to media eviction | 1 minute Scheduler cadence; timing is **not exact-to-the-second** and must be communicated |
| Revocation queue oldest pending | Alert if age >2 minutes; critical if age >5 minutes |
| Maintenance HTTP 401/403 | Security incident, wrong OIDC audience or unknown service account |
| Maintenance 503 / limit reached | Retry, page an operator for persistent failures; no fabricated success |
| Attendee count and media-downstream bytes | Establish baseline 20/50/100 real participants; alert at 75/90% of spend budget |
| Active connection after entitlement revoked | Zero is required after Cloud eviction is acknowledged; reconcile vendor state before accepting |

Suggested dashboard query views: `liveClassroomRevocations` where `state in [pending,processing]`; `liveClassroomMaintenance/reconciler` for `summary`, `startedAt`, `finishedAt` and lease; attendance remains **provisional** until reconciled with provider events. Do not log JWTs, full learner UIDs, enrollment email addresses or provider API secrets.

## Failure and rollback

- **Provider unavailable:** persisted entitlement remains revoked; the outbox stays pending and the endpoint returns 503. Cloud Scheduler retries; operator reviews provider availability and backlog without reactivating the learner.
- **Cloud Scheduler outage:** previously scheduled expiries are not evicted until subsequent successful reconciliation. The current code's new token issuance and signed join-webhook check still deny expired access, but established streams need the provider eviction. Do not promise hard second-accurate expiry.
- **Large historical cohorts:** dispatch currently fails closed when an enrollment maps to more than 100 registered rooms. Requires pagination and a scale validation before such programs are approved.
- **Unexpected auth errors:** verify OIDC audience, exact service-account email and service agent IAM; never replace with an unverified static secret.
- **Rollback:** revert/disable the newly protected maintenance invocation and keep the live classroom feature flag off if provider revocation semantics or monitoring are not reliable. Do not delete the Firestore pending outbox or issue replacement tokens to revoked attendees.
- **No data-recovery bypass:** processing state cannot be declared done if the provider removal failed. A valid replacement enrollment or payment reactivation is checked before evicting an attendee.

## Data protection and retention gate

LUMA stores pseudonymous provider identities but an authorized attendance roster also maps them to Firebase UIDs. These are personal data; access must remain tenant- and coach-scoped. Before enterprise enablement establish a **written data-retention policy** for raw join/leave events, roster records and individual attendance, including retention by tenant, lawful deletion/export, legal hold and a verified purge job. Do not silently choose or apply an irreversible retention period. Set `recordingPolicy=none` for Seres classes that prohibit institution-managed recording; the policy cannot prevent a participant's local screen recording.

## Non-negotiable acceptance remaining

- [ ] Dedicated LiveKit Cloud project and verified disabled automatic room creation.
- [ ] Cloud-only WebRTC/revoke JWT replay/close-room test PASS at reviewed SHA.
- [ ] Authenticated LUMA Firebase tenant, instructor and two actual learner accounts in a staging deployment; practice, chat, hand raise and moderation traversed in browser with recorded evidence.
- [ ] Signed commerce refund and institutional revocation disconnect **already-connected** users with measured latency, retries and reactivation safety.
- [ ] Google Scheduler identity, Firestore indexes READY, durable backlog metrics and repeatable incident runbook operational in authorized environment.
- [ ] Capacity load at 20/50/100 with real track subscriptions, constrained device matrix, accessibility and support escalation.
- [ ] Independent reviewer attests source SHA, browser UI, real business journeys and the published deployment SHA. No fictitious attestation.


## Firestore test isolation

The reconciler intentionally processes globally pending work. The ordinary commerce
emulator suites produce historical refunded and pending fixtures. A shared emulator
makes a successful maintenance run correctly return `partial_failure` when unrelated
fixtures cannot be reconciled. CI therefore starts a **new, isolated Firebase
emulator instance** for maintenance integration tests after the main suite. Do not
weaken the production job by ignoring partial failures or changing asserted
postconditions. The new job still checks that a bad vendor response is retryable.


## Runtime deadline and non-overlapping sweeps

The worker issues a **120-second Firestore lease**, intentionally longer than the
documented Cloud Scheduler **90-second request deadline**. It checks a
**75-second cooperative execution budget** before starting each enrollment and
pending media removal; remaining work stays persisted and surfaces as a
retryable `partial_failure`, not a false success. External provider requests
can themselves still run longer than this cooperative budget: a separate
provider timeout and long-running load test remain mandatory before activation.
