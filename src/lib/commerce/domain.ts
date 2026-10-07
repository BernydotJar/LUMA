export type CommerceProviderId = "hotmart" | "stripe" | (string & {});

export type CommerceEventType =
  | "commerce.payment.confirmed"
  | "commerce.payment.failed"
  | "commerce.payment.refunded"
  | "commerce.subscription.created"
  | "commerce.subscription.renewed"
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

function requiredIdentityPart(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export function commerceIdempotencyKey(
  event: Pick<NormalizedCommerceEvent, "provider" | "externalEventId">,
): string {
  const provider = requiredIdentityPart(event.provider, "provider");
  const externalEventId = requiredIdentityPart(event.externalEventId, "externalEventId");
  return `${provider}:${externalEventId}`;
}

export function entitlementIdentityKey(identity: EntitlementIdentity): string {
  return [
    requiredIdentityPart(identity.tenantId, "tenantId"),
    requiredIdentityPart(identity.customerId, "customerId"),
    requiredIdentityPart(identity.productId, "productId"),
  ].join(":");
}

export function commerceSourceEvent(event: NormalizedCommerceEvent): CommerceSourceEvent {
  return {
    provider: event.provider,
    externalEventId: event.externalEventId,
    type: event.type,
    occurredAt: event.occurredAt,
  };
}
