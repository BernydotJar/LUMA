import { describe, expect, it } from "vitest";
import { HotmartProvider } from "./hotmart";

const secret = "hotmart-secret";

function payload(event = "PURCHASE_APPROVED") {
  return JSON.stringify({
    id: "evt-hotmart-1",
    creation_date: 1791396000000,
    event,
    version: "2.0.0",
    data: {
      product: {
        id: 213344,
        ucode: "product-ucode",
        external_id: "pnl-practitioner",
        name: "Practitioner PNL",
      },
      buyer: {
        ucode: "buyer-ucode",
        email: "Buyer@Example.com",
        name: "Buyer Name",
      },
      purchase: {
        transaction: "HP123",
        status: "APPROVED",
        recurrence_number: 1,
      },
    },
  });
}

describe("HotmartProvider", () => {
  it("verifies Hottok and normalizes approved purchase", async () => {
    const event = await new HotmartProvider(secret).handleWebhook({
      headers: { "X-HOTMART-HOTTOK": secret },
      rawBody: payload(),
    });

    expect(event).toMatchObject({
      provider: "hotmart",
      externalEventId: "evt-hotmart-1",
      type: "commerce.payment.confirmed",
      customerExternalId: "buyer-ucode",
      productExternalId: "pnl-practitioner",
      transactionExternalId: "HP123",
      metadata: {
        buyerEmail: "buyer@example.com",
        productName: "Practitioner PNL",
      },
    });
  });

  it("maps refund to a revoking payment event", async () => {
    const event = await new HotmartProvider(secret).handleWebhook({
      headers: { "x-hotmart-hottok": secret },
      rawBody: payload("PURCHASE_REFUNDED"),
    });
    expect(event.type).toBe("commerce.payment.refunded");
  });

  it("maps recurring approved purchase to subscription creation", async () => {
    const data = JSON.parse(payload());
    data.data.subscription = {
      subscriber: { code: "sub-1" },
    };
    const event = await new HotmartProvider(secret).handleWebhook({
      headers: { "x-hotmart-hottok": secret },
      rawBody: JSON.stringify(data),
    });
    expect(event.type).toBe("commerce.subscription.created");
  });

  it("rejects invalid Hottok before parsing business payload", async () => {
    await expect(
      new HotmartProvider(secret).handleWebhook({
        headers: { "x-hotmart-hottok": "wrong" },
        rawBody: payload(),
      }),
    ).rejects.toThrow("HOTMART_SIGNATURE_INVALID");
  });

  it("rejects unsupported events", async () => {
    await expect(
      new HotmartProvider(secret).handleWebhook({
        headers: { "x-hotmart-hottok": secret },
        rawBody: payload("CART_ABANDONMENT"),
      }),
    ).rejects.toThrow("HOTMART_EVENT_UNSUPPORTED");
  });
});
