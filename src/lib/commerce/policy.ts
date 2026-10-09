import type {
  EntitlementAction,
  NormalizedCommerceEvent,
} from "./domain";

export function entitlementActionForCommerceEvent(
  event: Pick<NormalizedCommerceEvent, "type">,
): EntitlementAction {
  switch (event.type) {
    case "commerce.payment.confirmed":
    case "commerce.subscription.created":
    case "commerce.subscription.renewed":
      return "grant";
    case "commerce.payment.refunded":
    case "commerce.subscription.cancelled":
    case "commerce.subscription.expired":
      return "revoke";
    case "commerce.subscription.cancellation_scheduled":
    case "commerce.payment.failed":
    case "commerce.payment.partially_refunded":
      return "none";
  }
}
