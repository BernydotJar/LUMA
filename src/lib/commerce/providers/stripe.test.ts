import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { StripeProvider } from "./stripe";

const secret = "whsec_test";
const now = 1791396000;

function sign(rawBody: string, timestamp = now) {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function payload(type = "payment_intent.succeeded") {
  return JSON.stringify({
    id: "evt_stripe_1",
    type,
    created: now,
    data: {
      object: {
        id: "pi_1",
        customer: "cus_1",
        currency: "usd",
        metadata: {
          luma_product_id: "pnl-practitioner",
          buyer_email: "buyer@example.com",
        },
      },
    },
  });
}

describe("StripeProvider", () => {
  it("verifies signature and normalizes successful payment", async () => {
    const rawBody = payload();
    const event = await new StripeProvider(secret, {
      nowSeconds: () => now,
    }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) },
      rawBody,
    });

    expect(event).toMatchObject({
      provider: "stripe",
      externalEventId: "evt_stripe_1",
      type: "commerce.payment.confirmed",
      customerExternalId: "cus_1",
      productExternalId: "pnl-practitioner",
      transactionExternalId: "pi_1",
      metadata: { buyerEmail: "buyer@example.com" },
    });
  });

  it("maps subscription deletion to cancellation", async () => {
    const rawBody = payload("customer.subscription.deleted");
    const event = await new StripeProvider(secret, {
      nowSeconds: () => now,
    }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) },
      rawBody,
    });
    expect(event.type).toBe("commerce.subscription.cancelled");
  });

  it("keys subscription invoice renewals by subscription id", async () => {
    const rawBody = JSON.stringify({
      id: "evt_invoice_paid",
      type: "invoice.paid",
      created: now,
      data: {
        object: {
          id: "in_renewal",
          customer: "cus_1",
          payment_intent: "pi_renewal",
          subscription: "sub_1",
          currency: "usd",
        },
      },
    });

    const event = await new StripeProvider(secret, {
      nowSeconds: () => now,
    }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) },
      rawBody,
    });

    expect(event.type).toBe("commerce.subscription.renewed");
    expect(event.transactionExternalId).toBe("sub_1");
  });

  it("rejects tampered body", async () => {
    const rawBody = payload();
    await expect(
      new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
        headers: { "stripe-signature": sign(rawBody) },
        rawBody: rawBody.replace("cus_1", "cus_2"),
      }),
    ).rejects.toThrow("STRIPE_SIGNATURE_INVALID");
  });

  it("rejects stale signatures", async () => {
    const rawBody = payload();
    await expect(
      new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
        headers: {
          "stripe-signature": sign(rawBody, now - 301),
        },
        rawBody,
      }),
    ).rejects.toThrow("STRIPE_SIGNATURE_EXPIRED");
  });

  it("rejects unsupported Stripe events", async () => {
    const rawBody = payload("customer.updated");
    await expect(
      new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
        headers: { "stripe-signature": sign(rawBody) },
        rawBody,
      }),
    ).rejects.toThrow("STRIPE_EVENT_UNSUPPORTED");
  });
});
