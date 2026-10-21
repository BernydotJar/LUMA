# Next actions, in enterprise risk order

1. Review the `instructor_removed` regression and reproduce it on Firebase Emulator with application API/Firebase Auth identities, including purchase-after-expulsion and instructor-ban persistence.
2. Provision isolated LiveKit Cloud QA and Firebase staging credentials through protected environment-level secrets; do not put credentials in repository, PR comments or untrusted Actions jobs.
3. Run #75's dedicated Cloud media QA gate from a **trusted reviewed workflow** and extend to original/refreshed JWT replay and signed-webhook join fence. No GO from local OSS.
4. Run a 90-minute equivalent business scenario: admin creates schedule; instructor and two authenticated learners join; instructor camera/mic/chat/hand/screen share and moderation work; refund expels learner A while B/instructor remain; negative cross-tenant, cohort and revoked-users tests pass.
5. Collect action-by-action implementation, actionable UI, customer journey and published SHA evidence for all 20 critical actions; obtain truly independent SHA-bound Graph Harness review, CI required checks, release approval and rollback readiness.
