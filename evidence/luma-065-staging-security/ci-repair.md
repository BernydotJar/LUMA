# LUMA-065 CI validation repair

First independent Python staging workflow (GitHub Actions run `38000809290`) failed in the synthetic HTTP staging guard, **before querying any source**. The PostgreSQL Docker service returned `inet_server_addr()::text = '172.18.0.2/32'`, and Python `ipaddress.ip_address` expects a bare address without a CIDR mask. The source test environment uses a loopback-connected disposable `_test` database, but the server reports the Docker bridge interface.

Minimal repair: use `ipaddress.ip_interface(addr).ip.is_loopback`; retain the existing strict CI-only exception requiring `CI=true`, `_test` database name and localhost client host. Reject unparseable addresses. Unit tests now exercise CIDR bridge addresses, invalid addresses, production names and forbidden remote hosts. Local Python 23/23 and localhost staging 11/11 pass after the repair. The independent GitHub Actions rerun is required; the original run stays recorded as FAILED, not rewritten as PASS.
