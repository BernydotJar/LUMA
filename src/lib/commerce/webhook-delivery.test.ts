import { describe, expect, it } from "vitest";
import { webhookDeliveryHttp } from "./webhook-delivery";

describe("commerce webhook delivery acknowledgements", () => {
  it("acknowledges processed events for provider idempotency", () => {
    expect(webhookDeliveryHttp("processed")).toEqual({ status: 200 });
  });

  it.each(["pending_mapping", "pending_customer"] as const)(
    "returns retryable 503 for %s instead of accidentally acknowledging delivery",
    (status) => {
      expect(webhookDeliveryHttp(status)).toEqual({ status: 503, retryAfter: "60" });
    },
  );
});
