import {
  createHmac,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import type {
  CommerceEventType,
  CommerceProvider,
  NormalizedCommerceEvent,
  WebhookInput,
} from "../domain";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || undefined;
  }
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function isFullyRefundedCharge(object: JsonRecord): boolean {
  if (booleanValue(object.refunded) === true) return true;
  const amount = numberValue(object.amount);
  const amountRefunded = numberValue(object.amount_refunded);
  return (
    amount !== undefined &&
    amountRefunded !== undefined &&
    amount > 0 &&
    amountRefunded >= amount
  );
}

function header(
  headers: Readonly<Record<string, string | undefined>>,
  name: string,
): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && value) return value.trim();
  }
  return undefined;
}

function safeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowSeconds: number,
  toleranceSeconds: number,
) {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  const timestamp = timestampPart
    ? Number.parseInt(timestampPart.slice(2), 10)
    : Number.NaN;
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new Error("STRIPE_SIGNATURE_INVALID");
  }

  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new Error("STRIPE_SIGNATURE_EXPIRED");
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  if (!signatures.some((candidate) => safeHexEqual(candidate, expected))) {
    throw new Error("STRIPE_SIGNATURE_INVALID");
  }
}

function invoiceSubscriptionId(object: JsonRecord): string | undefined {
  const details = record(record(object.parent).subscription_details);
  return stringValue(object.subscription) ?? stringValue(details.subscription);
}

function stripeType(type: string, object: JsonRecord): CommerceEventType {
  switch (type) {
    case "payment_intent.succeeded":
      return "commerce.payment.confirmed";
    case "payment_intent.payment_failed":
    case "invoice.payment_failed":
      return "commerce.payment.failed";
    case "charge.refunded":
      return isFullyRefundedCharge(object)
        ? "commerce.payment.refunded"
        : "commerce.payment.partially_refunded";
    case "charge.dispute.created":
      return "commerce.payment.refunded";
    case "customer.subscription.created":
      return stringValue(object.status) === "active"
        ? "commerce.subscription.created"
        : "commerce.subscription.pending";
    case "customer.subscription.deleted":
      return "commerce.subscription.cancelled";
    case "invoice.paid":
      return invoiceSubscriptionId(object)
        ? "commerce.subscription.renewed"
        : "commerce.payment.confirmed";
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      if (stringValue(object.payment_status) !== "paid") {
        throw new Error("STRIPE_CHECKOUT_NOT_PAID");
      }
      return stringValue(object.mode) === "subscription"
        ? "commerce.subscription.created"
        : "commerce.payment.confirmed";
    case "checkout.session.async_payment_failed":
      return "commerce.payment.failed";
    default:
      throw new Error("STRIPE_EVENT_UNSUPPORTED");
  }
}

function occurredAt(created: unknown): string {
  if (typeof created !== "number" || !Number.isFinite(created)) {
    throw new Error("STRIPE_EVENT_CREATED_REQUIRED");
  }
  const date = new Date(created * 1000);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("STRIPE_EVENT_CREATED_INVALID");
  }
  return date.toISOString();
}

function metadataOf(object: JsonRecord): JsonRecord {
  return record(object.metadata);
}

function productExternalId(object: JsonRecord): string | undefined {
  const metadata = metadataOf(object);
  return (
    stringValue(metadata.luma_product_id) ??
    stringValue(metadata.product_id) ??
    stringValue(metadata.program_id)
  );
}

function buyerEmail(object: JsonRecord): string | undefined {
  const customerDetails = record(object.customer_details);
  const billingDetails = record(object.billing_details);
  return (
    stringValue(customerDetails.email) ??
    stringValue(billingDetails.email) ??
    stringValue(object.customer_email) ??
    stringValue(metadataOf(object).buyer_email)
  )?.toLowerCase();
}

function customerExternalId(object: JsonRecord): string | undefined {
  return (
    stringValue(object.customer) ??
    stringValue(metadataOf(object).luma_customer_id) ??
    buyerEmail(object)
  );
}

function transactionExternalId(
  eventType: string,
  object: JsonRecord,
): string | undefined {
  const subscriptionLifecycle =
    eventType.startsWith("invoice.") ||
    eventType.startsWith("customer.subscription.") ||
    ((eventType === "checkout.session.completed" ||
      eventType === "checkout.session.async_payment_succeeded") &&
      stringValue(object.mode) === "subscription");

  if (subscriptionLifecycle) {
    return (
      invoiceSubscriptionId(object) ??
      stringValue(object.id) ??
      stringValue(object.payment_intent)
    );
  }

  return (
    stringValue(object.payment_intent) ??
    stringValue(object.charge) ??
    stringValue(object.invoice) ??
    stringValue(object.subscription) ??
    stringValue(object.id) ??
    (eventType ? createHash("sha256").update(eventType).digest("hex") : undefined)
  );
}

function normalizedMetadata(
  eventType: string,
  object: JsonRecord,
): Readonly<Record<string, string>> {
  const entries: Array<[string, string | undefined]> = [
    ["providerEvent", eventType],
    ["buyerEmail", buyerEmail(object)],
    ["currency", stringValue(object.currency)],
    ["paymentStatus", stringValue(object.payment_status)],
    ["subscriptionStatus", stringValue(object.status)],
  ];
  return Object.fromEntries(
    entries.filter((item): item is [string, string] => Boolean(item[1])),
  );
}

export class StripeProvider implements CommerceProvider {
  readonly id = "stripe" as const;

  constructor(
    private readonly webhookSecret: string,
    private readonly options: {
      toleranceSeconds?: number;
      nowSeconds?: () => number;
    } = {},
  ) {
    if (!webhookSecret.trim()) throw new Error("STRIPE_WEBHOOK_SECRET_REQUIRED");
  }

  async handleWebhook(input: WebhookInput): Promise<NormalizedCommerceEvent> {
    const signature = header(input.headers, "stripe-signature");
    if (!signature) throw new Error("STRIPE_SIGNATURE_REQUIRED");

    const nowSeconds =
      this.options.nowSeconds?.() ?? Math.floor(Date.now() / 1000);
    verifyStripeSignature(
      input.rawBody,
      signature,
      this.webhookSecret,
      nowSeconds,
      this.options.toleranceSeconds ?? 300,
    );

    let payload: JsonRecord;
    try {
      payload = record(JSON.parse(input.rawBody));
    } catch {
      throw new Error("STRIPE_PAYLOAD_INVALID");
    }

    const externalEventId = stringValue(payload.id);
    const eventType = stringValue(payload.type);
    if (!externalEventId || !eventType) {
      throw new Error("STRIPE_EVENT_IDENTITY_REQUIRED");
    }

    const object = record(record(payload.data).object);

    return {
      provider: this.id,
      externalEventId,
      type: stripeType(eventType, object),
      occurredAt: occurredAt(payload.created),
      ...(customerExternalId(object)
        ? { customerExternalId: customerExternalId(object) }
        : {}),
      ...(productExternalId(object)
        ? { productExternalId: productExternalId(object) }
        : {}),
      ...(transactionExternalId(eventType, object)
        ? { transactionExternalId: transactionExternalId(eventType, object) }
        : {}),
      metadata: normalizedMetadata(eventType, object),
    };
  }
}
