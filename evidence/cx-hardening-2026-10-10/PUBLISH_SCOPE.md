# LUMA — Independent PR #39 QA (curated publication)

**Publication date:** 2026-10-12
**Audit date:** 2026-10-10
**Audited code SHA:** `7d1715c5171c464d6a4abd786f912418817fb397`
**Source:** Local independent QA branch `audit/independent-qa-pr39-20261010` (`6f8eb73`).
**Scope:** QA evidence and audit scripts only; **no product implementation, data or runtime settings** are changed by this branch.

## Purpose

Preserve the independently measured mobile geometry, accessibility summary, emulator-only authorization coverage, Lighthouse metrics and release decision for the original [PR #39](https://github.com/BernydotJar/LUMA/pull/39).

This audit remains historically **NO-GO** for the **original SHA**: browser CI [#38087249667](https://github.com/BernydotJar/LUMA/actions/runs/38087249667) failed on two flaky strict DOM locators; a real, approved learner-to-coach staging identity journey was not run; manual VoiceOver/TalkBack and true browser zoom were not completed; mobile lab LCP exceeded its 2.5s target.

## Subsequent development (do not conflate versions)

The dependent [draft PR #43](https://github.com/BernydotJar/LUMA/pull/43) introduced hydration/DOM-stability fixes and passed [CI #38099388393](https://github.com/BernydotJar/LUMA/actions/runs/38099388393) (131 browser tests passed, 21 skipped and no flaky tests, as reported by the fixer). **Passing CI on the later SHA does not retroactively change this original QA verdict.** Acceptance still requires an approved authenticated staging actor journey, manual assistive-tech verification and the remaining performance gate, followed by human approval.

## Publication boundary

Included: signed-off textual QA findings, measurable `after.json` geometry, compact Lighthouse and Graph validation summaries, selected non-sensitive repeatability checks.

Deliberately excluded: complete Lighthouse raw JSON, screenshots from user-facing browsers and other bulky raw captures. Original audit worktree remains local for independent review; this publication does not purport to reproduce the complete artifact package. Raw traces can also be inspected in the GitHub Actions artifact referenced in `release-decision.md` where authorized.

No real participant records, secrets, credentials or production configuration are included. The publication branch should **not** be merged into production automatically.
