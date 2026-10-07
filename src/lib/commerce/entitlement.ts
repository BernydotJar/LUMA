import {
  commerceSourceEvent,
  type CommerceProcessingOutcome,
  type EffectiveEntitlementAction,
  type EntitlementIdentity,
  type EntitlementRecord,
  type NormalizedCommerceEvent,
} from "./domain";

export interface EntitlementTransitionInput {
  entitlementId: string;
  identity: EntitlementIdentity;
  action: EffectiveEntitlementAction;
  event: NormalizedCommerceEvent;
  appliedAt: string;
  current?: EntitlementRecord;
}

export interface EntitlementTransitionResult {
  record: EntitlementRecord;
  outcome: CommerceProcessingOutcome;
  changed: boolean;
}

const actionPriority: Record<EffectiveEntitlementAction, number> = {
  grant: 1,
  revoke: 2,
};

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid ISO timestamp`);
  }
  return parsed;
}

function isStaleOrLowerPriority(
  current: EntitlementRecord,
  event: NormalizedCommerceEvent,
  action: EffectiveEntitlementAction,
): boolean {
  const incomingTime = timestamp(event.occurredAt, "event.occurredAt");
  const currentTime = timestamp(current.lastEffectiveAt, "entitlement.lastEffectiveAt");
  if (incomingTime < currentTime) return true;
  if (incomingTime > currentTime) return false;
  return actionPriority[action] <= actionPriority[current.lastAction];
}

export function applyEntitlementTransition(
  input: EntitlementTransitionInput,
): EntitlementTransitionResult {
  timestamp(input.appliedAt, "appliedAt");
  timestamp(input.event.occurredAt, "event.occurredAt");

  if (input.current && isStaleOrLowerPriority(input.current, input.event, input.action)) {
    return {
      record: input.current,
      outcome: "ignored_stale",
      changed: false,
    };
  }

  const source = commerceSourceEvent(input.event);

  if (!input.current) {
    if (input.action === "grant") {
      return {
        record: {
          ...input.identity,
          entitlementId: input.entitlementId,
          status: "active",
          version: 1,
          createdAt: input.appliedAt,
          updatedAt: input.appliedAt,
          grantedAt: input.appliedAt,
          lastEffectiveAt: input.event.occurredAt,
          lastAction: "grant",
          lastSourceEvent: source,
        },
        outcome: "granted",
        changed: true,
      };
    }

    return {
      record: {
        ...input.identity,
        entitlementId: input.entitlementId,
        status: "revoked",
        version: 1,
        createdAt: input.appliedAt,
        updatedAt: input.appliedAt,
        revokedAt: input.appliedAt,
        lastEffectiveAt: input.event.occurredAt,
        lastAction: "revoke",
        lastSourceEvent: source,
      },
      outcome: "revoked",
      changed: true,
    };
  }

  const nextVersion = input.current.version + 1;

  if (input.action === "grant") {
    const withoutRevocation = { ...input.current };
    delete withoutRevocation.revokedAt;

    return {
      record: {
        ...withoutRevocation,
        status: "active",
        version: nextVersion,
        updatedAt: input.appliedAt,
        grantedAt:
          input.current.status === "revoked"
            ? input.appliedAt
            : input.current.grantedAt ?? input.appliedAt,
        lastEffectiveAt: input.event.occurredAt,
        lastAction: "grant",
        lastSourceEvent: source,
      },
      outcome: input.current.status === "revoked" ? "reactivated" : "already_active",
      changed: true,
    };
  }

  return {
    record: {
      ...input.current,
      status: "revoked",
      version: nextVersion,
      updatedAt: input.appliedAt,
      revokedAt: input.appliedAt,
      lastEffectiveAt: input.event.occurredAt,
      lastAction: "revoke",
      lastSourceEvent: source,
    },
    outcome: input.current.status === "revoked" ? "already_revoked" : "revoked",
    changed: true,
  };
}
