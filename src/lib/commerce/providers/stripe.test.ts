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

  it("uses PaymentIntent receipt_email to enable customerless purchases", async () => {
    const rawBody = JSON.stringify({
      id: "evt_pi_receipt", type: "payment_intent.succeeded", created: now,
      data: { object: { id: "pi_receipt", receipt_email: "Customer@Example.com",
        status: "succeeded", metadata: { luma_product_id: "pnl-practitioner" } } },
    });
    const event = await new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) }, rawBody,
    });
    expect(event).toMatchObject({
      type: "commerce.payment.confirmed",
      customerExternalId: "customer@example.com",
      metadata: { buyerEmail: "customer@example.com" },
      productExternalId: "pnl-practitioner",
    });
  });

  it.each(["unpaid", "incomplete_expired", "paused"])(
    "revokes a subscription when Stripe status becomes %s", async (status) => {
      const rawBody = JSON.stringify({
        id: `evt_status_${status}`, type: "customer.subscription.updated", created: now,
        data: { object: { id: "sub_state", customer: "cus_1", status } },
      });
      const event = await new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
        headers: { "stripe-signature": sign(rawBody) }, rawBody,
      });
      expect(event.type).toBe("commerce.subscription.expired");
      expect(event.transactionExternalId).toBe("sub_state");
    },
  );

  it("grants on paid subscription recovery but preserves access during past_due", async () => {
    for (const [status, expected] of [
      ["active", "commerce.subscription.renewed"],
      ["past_due", "commerce.payment.failed"],
    ] as const) {
      const rawBody = JSON.stringify({
        id: `evt_${status}`, type: "customer.subscription.updated", created: now,
        data: { object: { id: "sub_status", customer: "cus_1", status } },
      });
      const event = await new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
        headers: { "stripe-signature": sign(rawBody) }, rawBody,
      });
      expect(event.type).toBe(expected);
    }
  });

  it.each([
    ["charge.dispute.closed", "won", "commerce.payment.confirmed"],
    ["charge.dispute.closed", "lost", "commerce.payment.refunded"],
    ["charge.dispute.funds_reinstated", "won", "commerce.payment.confirmed"],
  ] as const)("maps %s / %s to %s using the disputed Charge", async (type, status, expected) => {
    const rawBody = JSON.stringify({
      id: `evt_${type}_${status}`, type, created: now,
      data: { object: { id: "dp_123", charge: "ch_123", status } },
    });
    const event = await new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) }, rawBody,
    });
    expect(event.type).toBe(expected);
    expect(event.transactionExternalId).toBe("ch_123");
  });

  it("captures latest_charge as a payment binding alias for disputes", async () => {
    const rawBody = JSON.stringify({ id: "evt_payment", type: "payment_intent.succeeded",
      created: now, data: { object: { id: "pi_payment", latest_charge: "ch_payment",
        customer: "cus_payment", metadata: { luma_product_id: "product" } } } });
    const event = await new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) }, rawBody,
    });
    expect(event.transactionExternalId).toBe("pi_payment");
    expect(event.metadata?.chargeExternalId).toBe("ch_payment");
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

  it("normalizes basil invoice.paid using parent.subscription_details.subscription", async () => {
    const rawBody = JSON.stringify({
      id: "evt_invoice_basil", type: "invoice.paid", created: now,
      data: { object: { id: "in_basil", customer: "cus_1",
        payment_intent: "pi_basil", parent: { type: "subscription_details",
          subscription_details: { subscription: "sub_basil" } } } },
    });
    const event = await new StripeProvider(secret, { nowSeconds: () => now })
      .handleWebhook({ headers: { "stripe-signature": sign(rawBody) }, rawBody });
    expect(event.type).toBe("commerce.subscription.renewed");
    expect(event.transactionExternalId).toBe("sub_basil");
  });

  it.each([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
  ])("keys paid Checkout subscriptions by sub_ id for %s", async (type) => {
    const rawBody = JSON.stringify({
      id: `evt_${type}`, type, created: now,
      data: { object: {
        id: "cs_checkout", customer: "cus_checkout",
        subscription: "sub_checkout", payment_intent: "pi_checkout",
        mode: "subscription", payment_status: "paid",
        metadata: { luma_product_id: "pnl-practitioner" },
      } },
    });
    const event = await new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) }, rawBody,
    });
    expect(event.type).toBe("commerce.subscription.created");
    expect(event.transactionExternalId).toBe("sub_checkout");
  });

  it("extracts subscription invoice payment intent from Basil payments", async () => {
    const rawBody = JSON.stringify({
      id: "evt_invoice_alias", type: "invoice.paid", created: now,
      data: { object: { id: "in_alias", customer: "cus_alias",
        parent: { subscription_details: { subscription: "sub_alias" } },
        payments: { data: [{ payment: { type: "payment_intent",
          payment_intent: "pi_alias" } }] },
      } },
    });
    const event = await new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) }, rawBody,
    });
    expect(event.transactionExternalId).toBe("sub_alias");
    expect(event.metadata?.paymentIntentExternalId).toBe("pi_alias");
  });

  it("preserves every PaymentIntent in a partially-paid Stripe subscription invoice", async () => {
    const rawBody = JSON.stringify({
      id: "evt_invoice_multi", type: "invoice.paid", created: now,
      data: { object: { id: "in_multi", customer: "cus_multi",
        parent: { subscription_details: { subscription: "sub_multi" } },
        payments: { data: [
          { payment: { type: "payment_intent", payment_intent: "pi_first" } },
          { payment: { type: "payment_intent", payment_intent: "pi_second" } },
        ] },
      } },
    });
    const event = await new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) }, rawBody,
    });
    expect(event.transactionExternalId).toBe("sub_multi");
    expect(JSON.parse(event.metadata?.paymentIntentExternalIds ?? "[]"))
      .toEqual(["pi_first", "pi_second"]);
  });

  it("extracts charge aliases from legacy subscription invoice payment", async () => {
    const rawBody = JSON.stringify({
      id: "evt_invoice_charge", type: "invoice.paid", created: now,
      data: { object: { id: "in_charge", customer: "cus_alias",
        subscription: "sub_alias", payment_intent: "pi_alias",
        charge: "ch_alias" } },
    });
    const event = await new StripeProvider(secret, { nowSeconds: () => now }).handleWebhook({
      headers: { "stripe-signature": sign(rawBody) }, rawBody,
    });
    expect(event.metadata).toMatchObject({
      paymentIntentExternalId: "pi_alias", chargeExternalId: "ch_alias",
    });
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
