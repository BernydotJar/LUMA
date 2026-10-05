# Authentication E2E Summary

## Chromium

Final desktop run:
- 22 passed
- 4 project-specific mobile tests skipped
- 0 failed

## Mobile

Final mobile run:
- 25 passed
- 1 intentional WCAG duplicate skip
- 0 failed

The mobile suite includes:
- Google login entry surface;
- guest learner state;
- login viewport geometry;
- seven-module responsive flow;
- theme switching;
- learner practice and evidence;
- Spanish terminology.

## Authentication boundary

Automated tests do not enter credentials for a real Google account.

Firebase / Identity Platform was instead verified through:
- Google provider enabled;
- OAuth client present;
- production App Hosting domain authorized;
- Firebase accounts:createAuthUri returns a Google authorization URI.

The interactive account-consent screen is therefore left to a real user session.
