# Google Authentication + Participant Profile — Independent Verification

## Decision

PASS_FOR_CLIENT_DEMO

## Product behavior

- A new /login entry explains the authentication purpose before asking for Google access.
- Google is the identity provider.
- Guest/demo mode remains available so a demo is never blocked by authentication.
- When signed in, LUMA uses the Google display name as the starting name.
- The participant can change the display name from the account menu.
- The selected display name is written back to the Firebase Auth user profile and persists with that account.
- Logged-out learner surfaces do not pretend to know the participant's identity.
- Mobile account controls collapse to a compact avatar/access control.

## Firebase / Identity Platform verification

Project: luma-learning-intelligence

Verified:
- Identity Platform project configuration available;
- Google provider enabled;
- OAuth client provisioned;
- authorized domains include Firebase domains, localhost, and the production App Hosting domain;
- accounts:createAuthUri returns a Google auth URI for the production /login continue URI.

No Google password or user credential is stored by LUMA.

## Automated quality

- lint: PASS
- TypeScript: PASS
- unit tests: 19/19 PASS
- production build: PASS
- Chromium E2E: 22 PASS, 4 project-specific skips
- Mobile E2E: 25 PASS, 1 intentional skip
- production dependency vulnerabilities: 0

## Residual boundary

A fully completed OAuth consent flow requires an actual human Google account. Automation verifies provider configuration and app behavior up to that account boundary.
