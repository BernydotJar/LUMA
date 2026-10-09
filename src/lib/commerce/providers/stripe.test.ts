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

  it("does not grant access to incomplete subscriptions before payment", async () => {
    const rawBody = JSON.stringify({
      id: "evt_sub_incomplete", type: "customer.subscription.created", created: now,
      data: { object: { id: "sub_incomplete", customer: "cus_1",
        status: "incomplete", metadata: { luma_product_id: "pnl-practitioner" } } },
    });
    const event = await new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) }, rawBody,
    });
    expect(event.type).toBe("commerce.subscription.pending");
    expect(event.transactionExternalId).toBe("sub_incomplete");
  });

  it("allows a paid active subscription to activate", async () => {
    const rawBody = JSON.stringify({
      id: "evt_sub_active", type: "customer.subscription.created", created: now,
      data: { object: { id: "sub_active", customer: "cus_1",
        status: "active", metadata: { luma_product_id: "pnl-practitioner" } } },
    });
    const event = await new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) }, rawBody,
    });
    expect(event.type).toBe("commerce.subscription.created");
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

  it("activates delayed Checkout payments on async success", async () => {
    const rawBody = JSON.stringify({
      id: "evt_async_success",
      type: "checkout.session.async_payment_succeeded",
      created: now,
      data: {
        object: {
          id: "cs_async",
          customer: "cus_async",
          mode: "payment",
          payment_status: "paid",
          payment_intent: "pi_async",
          metadata: { luma_product_id: "pnl-practitioner" },
        },
      },
    });

    const event = await new StripeProvider(secret, {
      nowSeconds: () => now,
    }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) },
      rawBody,
    });

    expect(event).toMatchObject({
      type: "commerce.payment.confirmed",
      transactionExternalId: "pi_async",
    });
  });

  it("does not revoke entitlement for partial charge refunds", async () => {
    const rawBody = JSON.stringify({
      id: "evt_partial_refund",
      type: "charge.refunded",
      created: now,
      data: {
        object: {
          id: "ch_partial",
          customer: "cus_1",
          amount: 10000,
          amount_refunded: 2500,
          refunded: false,
        },
      },
    });

    const event = await new StripeProvider(secret, {
      nowSeconds: () => now,
    }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) },
      rawBody,
    });

    expect(event.type).toBe("commerce.payment.partially_refunded");
  });

  it("revokes entitlement for a fully refunded charge", async () => {
    const rawBody = JSON.stringify({
      id: "evt_full_refund",
      type: "charge.refunded",
      created: now,
      data: {
        object: {
          id: "ch_full",
          customer: "cus_1",
          amount: 10000,
          amount_refunded: 10000,
          refunded: true,
        },
      },
    });

    const event = await new StripeProvider(secret, {
      nowSeconds: () => now,
    }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) },
      rawBody,
    });

    expect(event.type).toBe("commerce.payment.refunded");
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
