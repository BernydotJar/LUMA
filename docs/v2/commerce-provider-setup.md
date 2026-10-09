# LUMA V2 — Commerce Provider Setup

## Endpoints

- Hotmart: `POST /api/commerce/webhooks/hotmart`
- Stripe: `POST /api/commerce/webhooks/stripe`
- Admin mappings: `GET|POST /api/commerce/admin/mappings`
- Learner access claim: `GET /api/commerce/access`

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
