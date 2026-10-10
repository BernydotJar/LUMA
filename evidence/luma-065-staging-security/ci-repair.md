# LUMA-065 CI validation repair

First independent Python staging workflow (GitHub Actions run `38000809290`) failed in the synthetic HTTP staging guard, **before querying any source**. The PostgreSQL Docker service returned `inet_server_addr()::text = '172.18.0.2/32'`, and Python `ipaddress.ip_address` expects a bare address without a CIDR mask. The source test environment uses a loopback-connected disposable `_test` database, but the server reports the Docker bridge interface.

Minimal repair: use `ipaddress.ip_interface(addr).ip.is_loopback`; retain the existing strict CI-only exception requiring `CI=true`, `_test` database name and localhost client host. Reject unparseable addresses. Unit tests now exercise CIDR bridge addresses, invalid addresses, production names and forbidden remote hosts. Local Python 23/23 and localhost staging 11/11 pass after the repair. The independent GitHub Actions rerun is required; the original run stays recorded as FAILED, not rewritten as PASS.

## Mobile E2E navigation regression found in the combined release gate

The independent Product quality job (`38000978682`) passed LUMA verify/build, Firestore and dependency audit, but Playwright failed a mobile-only navigation assertion three times. The learner navigation gained the `Certificados` destination, while `AppShell` still rendered only `navigation.slice(0,4)` on mobile. This hid the fifth destination, `LUMA`, from mobile learners. The root cause is deterministic product behavior, not a test timing flake or a Scoped RAG data leak.

Minimal product fix: retain **all five learner** destinations (Hoy, Ruta, Programa, Certificados, LUMA) in the mobile bottom navigation, while keeping the four-item studio mobile navigation unchanged. The learner CSS now uses five equal minimum-zero columns with compact nonwrapping labels, preserving touch-target width. Added a dedicated mobile Playwright test requiring both Certificados and LUMA to be visible, usable and free of horizontal overflow. Release approval remains blocked until the corrected browser job passes independently.
