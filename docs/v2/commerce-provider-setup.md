# LUMA V2 — Commerce Provider Setup

## Endpoints

- Hotmart: `POST /api/commerce/webhooks/hotmart`
- Stripe: `POST /api/commerce/webhooks/stripe`
- Admin mappings: `GET|POST /api/commerce/admin/mappings`
- Learner access claim: `GET /api/commerce/access`
- Global admin-only access trace: `GET /api/commerce/admin/access-trace?tenantId=<tenant>&entitlementId=<64-hex>` (Firebase Bearer token; no raw PII)

## Learner access for a commerce-backed pilot

Set `LUMA_LEARNING_ACCESS_MODE=entitled` and `LUMA_LEARNING_TENANT_ID=<canonical-tenant-id>` in the trusted runtime environment **only after** merchant sandbox provisioning and the actual authorized corpus are verified. This fails closed for the learning plan/event APIs, tutor, and Content Intelligence. Leaving the mode unset preserves the existing showcase; this does **not** prove commercial access control. See `docs/enterprise/learning-access-policy.md`. The tenant is configuration, not supplied by the learner.

## Required server secrets

- `HOTMART_HOTTOK`
- `STRIPE_WEBHOOK_SECRET`

Do not place these values in source control or expose them through `NEXT_PUBLIC_*` variables.

## Product mapping

Before enabling a provider product, an admin creates a mapping:

```json
{
  "provider": "hotmart",
  "externalProductId": "<provider product id>",
  "tenantId": "<tenant>",
  "productId": "<canonical product>",
  "programId": "<canonical learning program>",
  "offeringId": "<specific live cohort offering id, when applicable>",
  "active": true
}
```

Stripe uses the same shape with `provider: "stripe"`.

## Operational sequence

1. Create provider product mapping.
2. Configure the provider webhook and secret.
3. Send a provider test/sandbox event.
4. Confirm ProviderEvent receipt.
5. Confirm Entitlement.
6. Confirm Enrollment.
7. Sign in with the purchaser's verified email and confirm access claim.
8. Replay the same event and verify no duplicate mutation.
9. Issue a test refund/cancellation and verify revocation.
10. Test a temporarily missing mapping, add the mapping, replay, and verify recovery.

No real-money product should be enabled until this sequence passes.


## Provider lifecycle edge cases

- **Stripe delayed payment methods:** LUMA does not grant access from an unpaid `checkout.session.completed`. Access is granted when Stripe later delivers `checkout.session.async_payment_succeeded`.
- **Stripe partial refunds:** a partial charge refund is recorded but does not revoke the full enrollment; a full refund revokes according to the entitlement policy.
- **Hotmart subscription cancellation:** the adapter supports the V2 cancellation payload where subscriber identity is provided at `data.subscriber`; the stable subscriber code is used to correlate the subscription lifecycle.

The provider sandbox checklist should include all three cases before real-money activation.

## Paid-through cancellation

For Hotmart V2 `SUBSCRIPTION_CANCELLATION`, the documented `data.date_next_charge` is the last paid-access boundary. LUMA schedules effective expiration rather than revoking immediately when the boundary is in the future. Missing/invalid boundaries are retried for reconciliation rather than interpreted as immediate cancellation. A successful later renewal clears the pending expiration.

The effective-access predicate must be enforced on every protected learner feature; do not use the raw `status` field alone to grant access. Provider webhook rate limits are best-effort per instance; production ingress protections should be managed separately at the edge.

For live/hybrid products, `offeringId` must reference the exact cohort in `programOfferings`. The learner schedule fails closed if no offering assignment exists. Configure distinct provider product/offer mappings for parallel cohorts. An asynchronous product may omit `offeringId`.

## Mapping administration and webhook ingress

`GET /api/commerce/admin/mappings` is cursor paginated. Use `?limit=100` (1–250) and then the returned `nextCursor` on the following request (`?limit=100&cursor=<nextCursor>`). Ordering is stable by Firestore document ID; `nextCursor: null` signals the final page. Admin authorization is required on every page.

A mapped `offeringId` assigns a learner to a specific live cohort. Explicitly send `offeringId: null` on an administrator mapping update to clear the cohort for future enrollments. On a new grant/renewal with a resolved cohortless mapping, the enrollment no longer retains a stale cohort; existing durable provider bindings retain their original purchase identity and may require an explicit migration for previously sold live cohort access.

Webhook ingress applies a per-client throttle before reading the bounded body. The provider-wide shared throttle is debited **only after** Stripe signature/Hotmart Hottok validation. Those limits are per-instance defense-in-depth; edge/global protection and provider retry behavior remain operational requirements.

## Stripe retry and dunning semantics

A verified webhook that is durably received but cannot yet resolve its product mapping or customer is **not** acknowledged as complete: the API returns `503` and `Retry-After: 60`, retaining the failed event for a provider retry. This supports out-of-order deliveries such as `invoice.paid` before an `incomplete` subscription's mapping/binding event. `200` is reserved for processed/idempotent events. Configure Stripe's endpoint with retry support and reconcile persistent failures operationally.

`customer.subscription.updated` to `unpaid`, `canceled`, `incomplete_expired`, or `paused` revokes access; `active` re-grants it after recovery. `past_due` preserves access while Stripe's configurable dunning grace period is in progress.

## Purchase-level entitlements and disputes

Ledger entitlements are keyed by tenant, customer, canonical product and **stable purchase/subscription identity** (`purchaseKey = provider:transactionExternalId`). Two purchases of the same product create two enrollments; cancellation/refund of one leaves the other purchase active. Stripe PaymentIntent `latest_charge` is retained as an alias to route dispute webhooks (`charge.dispute.created`, `closed: won/lost`, and `funds_reinstated`) back to the original entitlement. Dispute restoration re-grants only the corresponding purchase.

The coach intervention dashboard samples up to 100 learner records and returns the top eight signals **from the sample**; the summary is sample-based, not a full-tenant population or SLA count. Large-scale ranking needs a persistent projection/queue under the capacity-resilience workstream.

## Stripe subscription invoice refund aliases

Subscription Checkout is keyed by the Stripe `sub_` identifier. On `invoice.paid`, when the invoice includes an actual PaymentIntent (`payment_intent` or its embedded `payments.data[].payment.payment_intent`) and/or Charge identifier (`charge`), LUMA records every PaymentIntent listed in the signed invoice as an alias of the **same subscription entitlement**. Refund and dispute webhooks using a `pi_` or `ch_` identifier then resolve that original binding rather than granting/revoking a second enrollment. If a provider event contains no usable reference and no existing binding, the durable event stays pending with an HTTP 503 retry; do not infer a subscription from an invoice ID.

`GET /api/programs/admin/offerings/{offeringId}/sessions` returns one stable, ascending page by `startsAt` and document ID (`limit` 1–250, default 100). Follow `nextCursor` until null. Cursors encode both ordering keys; invalid ones receive HTTP 400.

A missing `STRIPE_WEBHOOK_SECRET` returns HTTP 503 `commerce_provider_not_configured` to distinguish deployment misconfiguration from malformed signatures (401).
