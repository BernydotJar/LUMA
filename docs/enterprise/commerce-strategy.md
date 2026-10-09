# Commerce — Hotmart Coexistence, Optional Stripe

**Commercial North Star:** Hotmart + LUMA + Stripe where economically appropriate.

## VERIFIED at source level

- Provider-neutral `NormalizedCommerceEvent` + Hottok / Stripe-HMAC adapters at `/api/commerce/webhooks/{provider}`.
- Firestore event ledger with replay-safe provider event ID, correlation, processing outcome and retryable mapping failures.
- Tenant and product mapping, immutable purchase identity, entitlements, enrollment, verified identity claim and effective expiration.
- Stripe supports invoice aliases, refunds/disputes, async Checkout confirmation and subscriptions; Hotmart supports approved, refund/chargeback, delayed cancellation and expiration. Neither merchant payload leaks into core learning logic.
- Authorized admin trace: `GET /api/commerce/admin/access-trace?tenantId=<tenant>&entitlementId=<64-hex>`. Requires Firebase ID token with GLOBAL admin role; returns no raw provider payload/email.

## NOT YET VERIFIED / deferred

- Provider account keys and real test-mode receipts, product mapping, subscriptions, retries and settlement terms in the actual LUMA hosting environment.
- Creation of a new Stripe Checkout Session from LUMA: **not implemented**. Webhook intake alone does not constitute an owned direct checkout experience.
- Manual/CRM/bulk enrollment adapters: future architecture, not production-ready.
- Payment provider fee savings: actual negotiated Hotmart fee is unknown. No generic 9.9%, 7% or 5% fee may substitute for the customer's actual effective rate.

## Activation steps

1. Obtain merchant-provided test mode IDs and provision secrets using Secret Manager with scoped backend permission.
2. Create and verify product → tenant/program/cohort mappings; confirm legal source and ownership.
3. Send one authenticated sandbox purchase event and inspect ledger/entitlement/enrollment; claim with purchaser's verified Firebase email.
4. Perform duplicate, out-of-order, unknown product/customer, timeout, refund, chargeback, expired subscription and provider retry tests. Unresolved mappings must return retryable errors.
5. Onboard to initialize the actual learner Twin without manufactured performance data.
6. Only then activate production merchant webhooks and operational reconciliation, alerting and support.

Hotmart remains the primary commercial route during the first pilot. Direct Stripe sales require a separate financial and operational decision.

## Learner API access in a pilot

The optional `LUMA_LEARNING_ACCESS_MODE=entitled` plus mandatory `LUMA_LEARNING_TENANT_ID` enforces effective enrollment for learner plan/events, Content Intelligence and tutor. It is a deployment-configured policy rather than a provider-specific conditional. See [learning access policy](learning-access-policy.md). This does not establish per-program RAG isolation or multi-tenant Twin protection.
