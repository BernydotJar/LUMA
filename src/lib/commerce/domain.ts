export type CommerceProviderId = "hotmart" | "stripe" | (string & {});

export type CommerceEventType =
  | "commerce.payment.confirmed"
  | "commerce.payment.failed"
  | "commerce.payment.refunded"
  | "commerce.payment.partially_refunded"
  | "commerce.subscription.created"
  | "commerce.subscription.renewed"
  | "commerce.subscription.cancellation_scheduled"
  | "commerce.subscription.cancelled"
  | "commerce.subscription.expired";

export interface NormalizedCommerceEvent {
  provider: CommerceProviderId;
  externalEventId: string;
  type: CommerceEventType;
  occurredAt: string;
  customerExternalId?: string;
  productExternalId?: string;
  transactionExternalId?: string;
  metadata?: Readonly<Record<string, string>>;
}

export interface WebhookInput {
  headers: Readonly<Record<string, string | undefined>>;
  rawBody: string;
}

export interface CommerceProvider {
  readonly id: CommerceProviderId;
  handleWebhook(input: WebhookInput): Promise<NormalizedCommerceEvent>;
}

export interface EntitlementIdentity {
  tenantId: string;
  customerId: string;
  productId: string;
}

export type CommerceSourceEvent = Pick<
  NormalizedCommerceEvent,
  "provider" | "externalEventId" | "type" | "occurredAt"
>;

export interface EntitlementCommand extends EntitlementIdentity {
  sourceEvent: CommerceSourceEvent;
}

export interface EnrollmentCommand {
  tenantId: string;
  learnerId: string;
  programId: string;
  entitlementId: string;
}

export type EntitlementAction = "grant" | "revoke" | "none";
export type EffectiveEntitlementAction = Exclude<EntitlementAction, "none">;
export type EntitlementStatus = "active" | "revoked";
export type ProviderEventProcessingStatus = "received" | "failed" | "processed";

export type CommerceProcessingOutcome =
  | "granted"
  | "reactivated"
  | "revoked"
  | "already_active"
  | "already_revoked"
  | "ignored_stale"
  | "no_entitlement_change";

export interface ProviderEventResolution extends EntitlementIdentity {
  entitlementId: string;
  action: EffectiveEntitlementAction;
}

export interface ProviderEventRecord {
  idempotencyKey: string;
  provider: CommerceProviderId;
  externalEventId: string;
  type: CommerceEventType;
  occurredAt: string;
  customerExternalId?: string;
  productExternalId?: string;
  transactionExternalId?: string;
  correlationId: string;
  receivedAt: string;
  processingStatus: ProviderEventProcessingStatus;
  processingAttempts: number;
  processedAt?: string;
  failedAt?: string;
  lastErrorCode?: string;
  outcome?: CommerceProcessingOutcome;
  resolution?: ProviderEventResolution;
}

export interface EntitlementRecord extends EntitlementIdentity {
  entitlementId: string;
  status: EntitlementStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  grantedAt?: string;
  revokedAt?: string;
  lastEffectiveAt: string;
  lastAction: EffectiveEntitlementAction;
  lastSourceEvent: CommerceSourceEvent;
}

const commerceTimestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/i;

function integerPart(value: string): number {
  return Number.parseInt(value, 10);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return days[month - 1] ?? 0;
}

export function commerceTimestampNanos(
  value: string,
  label = "timestamp",
): bigint {
  const match = commerceTimestampPattern.exec(value);
  if (!match) {
    throw new Error(
      `${label} must be RFC3339 with at most nanosecond precision`,
    );
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    fraction = "",
    zone,
    offsetSign,
    offsetHourText,
    offsetMinuteText,
  ] = match;

  const year = integerPart(yearText);
  const month = integerPart(monthText);
  const day = integerPart(dayText);
  const hour = integerPart(hourText);
  const minute = integerPart(minuteText);
  const second = integerPart(secondText);
  const offsetHour = offsetHourText ? integerPart(offsetHourText) : 0;
  const offsetMinute = offsetMinuteText ? integerPart(offsetMinuteText) : 0;
  const normalizedZone = zone.toUpperCase();

  const calendarValid =
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59 &&
    offsetHour >= 0 &&
    offsetHour <= 23 &&
    offsetMinute >= 0 &&
    offsetMinute <= 59 &&
    normalizedZone !== "-00:00";

  if (!calendarValid) {
    throw new Error(`${label} must be a valid RFC3339 timestamp`);
  }

  const wholeSecond = new Date(0);
  wholeSecond.setUTCFullYear(year, month - 1, day);
  wholeSecond.setUTCHours(hour, minute, second, 0);

  let offsetMinutes = 0;
  if (normalizedZone !== "Z") {
    const magnitude = offsetHour * 60 + offsetMinute;
    offsetMinutes = offsetSign === "+" ? magnitude : -magnitude;
  }

  const wholeMilliseconds =
    wholeSecond.getTime() - offsetMinutes * 60_000;
  if (!Number.isFinite(wholeMilliseconds)) {
    throw new Error(`${label} is outside the supported timestamp range`);
  }

  const fractionalNanos = BigInt(fraction.padEnd(9, "0"));
  return (
    BigInt(wholeMilliseconds) * BigInt(1_000_000) +
    fractionalNanos
  );
}

export function compareCommerceEventTimes(
  left: string,
  right: string,
): number {
  const a = commerceTimestampNanos(left, "left timestamp");
  const b = commerceTimestampNanos(right, "right timestamp");
  return a < b ? -1 : a > b ? 1 : 0;
}


function requiredIdentityPart(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export function commerceIdempotencyKey(
  event: Pick<NormalizedCommerceEvent, "provider" | "externalEventId">,
): string {
  const provider = requiredIdentityPart(event.provider, "provider");
  const externalEventId = requiredIdentityPart(
    event.externalEventId,
    "externalEventId",
  );
  return JSON.stringify([provider, externalEventId]);
}

export function normalizeEntitlementIdentity(
  identity: EntitlementIdentity,
): EntitlementIdentity {
  return {
    tenantId: requiredIdentityPart(identity.tenantId, "tenantId"),
    customerId: requiredIdentityPart(identity.customerId, "customerId"),
    productId: requiredIdentityPart(identity.productId, "productId"),
  };
}

export function entitlementIdentityKey(
  identity: EntitlementIdentity,
): string {
  const normalized = normalizeEntitlementIdentity(identity);
  return JSON.stringify([
    normalized.tenantId,
    normalized.customerId,
    normalized.productId,
  ]);
}

export function normalizeOptionalExternalId(
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function commerceSourceEvent(
  event: NormalizedCommerceEvent,
): CommerceSourceEvent {
  return {
    provider: requiredIdentityPart(event.provider, "provider") as CommerceProviderId,
    externalEventId: requiredIdentityPart(
      event.externalEventId,
      "externalEventId",
    ),
    type: event.type,
    occurredAt: event.occurredAt,
  };
}

export function processingIntentMatches(
  record: Pick<ProviderEventRecord, "resolution">,
  action: EntitlementAction,
  identity?: EntitlementIdentity,
): boolean {
  if (action === "none") return !record.resolution;
  if (!identity || !record.resolution) return false;

  const normalized = normalizeEntitlementIdentity(identity);
  return (
    record.resolution.action === action &&
    record.resolution.tenantId === normalized.tenantId &&
    record.resolution.customerId === normalized.customerId &&
    record.resolution.productId === normalized.productId
  );
}
