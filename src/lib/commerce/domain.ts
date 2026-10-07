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

export interface EntitlementCommand {
  tenantId: string;
  customerId: string;
  productId: string;
  sourceEvent: Pick<NormalizedCommerceEvent, "provider" | "externalEventId" | "type">;
}

export interface EnrollmentCommand {
  tenantId: string;
  learnerId: string;
  programId: string;
  entitlementId: string;
}

export function commerceIdempotencyKey(event: Pick<NormalizedCommerceEvent, "provider" | "externalEventId">): string {
  const provider = event.provider.trim();
  const externalEventId = event.externalEventId.trim();
  if (!provider || !externalEventId) throw new Error("Commerce idempotency requires provider and externalEventId");
  return `${provider}:${externalEventId}`;
}
