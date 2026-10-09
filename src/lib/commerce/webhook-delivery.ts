import type { CommerceOrchestrationStatus } from "./orchestrator";

/** Retry failed durable resolutions: Stripe/Hotmart do not retry successful 2xx. */
export function webhookDeliveryHttp(status: CommerceOrchestrationStatus): {
  status: 200 | 503;
  retryAfter?: string;
} {
  return status === "processed"
    ? { status: 200 }
    : { status: 503, retryAfter: "60" };
}
