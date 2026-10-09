import { createHash, timingSafeEqual } from "node:crypto";
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
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
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

function hotmartType(
  eventName: string,
  data: JsonRecord,
): CommerceEventType {
  const subscription = record(data.subscription);
  const purchase = record(data.purchase);
  const recurrence = numberValue(purchase.recurrence_number);
  const hasSubscription =
    Object.keys(subscription).length > 0 ||
    Boolean(stringValue(subscription.subscriber_code)) ||
    Boolean(stringValue(record(subscription.subscriber).code));

  switch (eventName) {
    case "PURCHASE_APPROVED":
    case "PURCHASE_COMPLETE":
      if (hasSubscription) {
        return recurrence && recurrence > 1
          ? "commerce.subscription.renewed"
          : "commerce.subscription.created";
      }
      return "commerce.payment.confirmed";
    case "PURCHASE_REFUNDED":
    case "PURCHASE_CHARGEBACK":
      return "commerce.payment.refunded";
    case "SUBSCRIPTION_CANCELLATION":
      return "commerce.subscription.cancelled";
    case "PURCHASE_CANCELED":
      return hasSubscription
        ? "commerce.subscription.cancelled"
        : "commerce.payment.failed";
    case "PURCHASE_EXPIRED":
      return hasSubscription
        ? "commerce.subscription.expired"
        : "commerce.payment.failed";
    case "PURCHASE_DELAYED":
      return "commerce.payment.failed";
    default:
      throw new Error("HOTMART_EVENT_UNSUPPORTED");
  }
}

function occurrenceIso(value: unknown): string {
  const milliseconds = numberValue(value);
  if (milliseconds === undefined) {
    throw new Error("HOTMART_CREATION_DATE_REQUIRED");
  }
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("HOTMART_CREATION_DATE_INVALID");
  }
  return date.toISOString();
}

function productExternalId(data: JsonRecord): string | undefined {
  const product = record(data.product);
  return (
    stringValue(product.external_id) ??
    stringValue(product.sku) ??
    stringValue(product.ucode) ??
    stringValue(product.id)
  );
}

function customerExternalId(
  eventName: string,
  data: JsonRecord,
): string | undefined {
  const buyer = record(data.buyer);
  const subscription = record(data.subscription);
  const subscriptionSubscriber = record(subscription.subscriber);
  const topLevelSubscriber = record(data.subscriber);
  const subscriberCode =
    stringValue(subscriptionSubscriber.code) ??
    stringValue(topLevelSubscriber.code);
  const subscriptionLifecycle =
    eventName === "SUBSCRIPTION_CANCELLATION" ||
    Object.keys(subscription).length > 0;

  if (subscriptionLifecycle && subscriberCode) return subscriberCode;

  return (
    stringValue(buyer.ucode) ??
    subscriberCode ??
    stringValue(buyer.email) ??
    stringValue(topLevelSubscriber.email)
  );
}

function transactionExternalId(
  eventName: string,
  data: JsonRecord,
): string | undefined {
  const subscription = record(data.subscription);
  const subscriptionSubscriber = record(subscription.subscriber);
  const topLevelSubscriber = record(data.subscriber);
  const subscriberCode =
    stringValue(subscriptionSubscriber.code) ??
    stringValue(topLevelSubscriber.code);
  const subscriptionLifecycle =
    eventName === "SUBSCRIPTION_CANCELLATION" ||
    Object.keys(subscription).length > 0;

  if (subscriptionLifecycle && subscriberCode) {
    return subscriberCode;
  }

  return stringValue(record(data.purchase).transaction);
}

function normalizedMetadata(
  payload: JsonRecord,
  data: JsonRecord,
): Readonly<Record<string, string>> {
  const product = record(data.product);
  const buyer = record(data.buyer);
  const purchase = record(data.purchase);
  const subscription = record(data.subscription);
  const subscriptionSubscriber = record(subscription.subscriber);
  const topLevelSubscriber = record(data.subscriber);
  const offer = record(purchase.offer);

  const entries: Array<[string, string | undefined]> = [
    ["providerEvent", stringValue(payload.event)],
    ["providerVersion", stringValue(payload.version)],
    [
      "buyerEmail",
      (stringValue(buyer.email) ??
        stringValue(topLevelSubscriber.email))?.toLowerCase(),
    ],
    [
      "buyerName",
      stringValue(buyer.name) ?? stringValue(topLevelSubscriber.name),
    ],
    ["productName", stringValue(product.name)],
    ["productUcode", stringValue(product.ucode)],
    ["offerCode", stringValue(offer.code)],
    [
      "subscriptionCode",
      stringValue(subscriptionSubscriber.code) ??
        stringValue(topLevelSubscriber.code),
    ],
    ["purchaseStatus", stringValue(purchase.status)],
  ];

  return Object.fromEntries(
    entries.filter((item): item is [string, string] => Boolean(item[1])),
  );
}

export class HotmartProvider implements CommerceProvider {
  readonly id = "hotmart" as const;

  constructor(private readonly hottok: string) {
    if (!hottok.trim()) throw new Error("HOTMART_HOTTOK_REQUIRED");
  }

  async handleWebhook(input: WebhookInput): Promise<NormalizedCommerceEvent> {
    const receivedToken = header(input.headers, "x-hotmart-hottok");
    if (
      !receivedToken ||
      !constantTimeEqual(receivedToken, this.hottok.trim())
    ) {
      throw new Error("HOTMART_SIGNATURE_INVALID");
    }

    let payload: JsonRecord;
    try {
      payload = record(JSON.parse(input.rawBody));
    } catch {
      throw new Error("HOTMART_PAYLOAD_INVALID");
    }

    const version = stringValue(payload.version);
    if (version && version !== "2.0.0") {
      throw new Error("HOTMART_VERSION_UNSUPPORTED");
    }

    const externalEventId = stringValue(payload.id);
    const eventName = stringValue(payload.event);
    if (!externalEventId || !eventName) {
      throw new Error("HOTMART_EVENT_IDENTITY_REQUIRED");
    }

    const data = record(payload.data);

    return {
      provider: this.id,
      externalEventId,
      type: hotmartType(eventName, data),
      occurredAt: occurrenceIso(payload.creation_date),
      ...(customerExternalId(eventName, data)
        ? { customerExternalId: customerExternalId(eventName, data) }
        : {}),
      ...(productExternalId(data)
        ? { productExternalId: productExternalId(data) }
        : {}),
      ...(transactionExternalId(eventName, data)
        ? { transactionExternalId: transactionExternalId(eventName, data) }
        : {}),
      metadata: normalizedMetadata(payload, data),
    };
  }
}
