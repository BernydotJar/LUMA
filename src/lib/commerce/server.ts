import { randomUUID } from "node:crypto";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { FirestoreCommerceEnrollmentStore } from "./enrollment";
import { FirestoreCommerceProviderBindingStore } from "./binding";
import { FirestoreCommerceLedger } from "./ledger";
import { FirestoreCommerceProductMappingStore } from "./mapping";
import { CommerceEnrollmentOrchestrator } from "./orchestrator";
import { HotmartProvider } from "./providers/hotmart";
import { StripeProvider } from "./providers/stripe";
import type {
  CommerceProvider,
  WebhookInput,
} from "./domain";

export const commerceLedger = new FirestoreCommerceLedger(
  firebaseAdminFirestore,
);
export const commerceMappings =
  new FirestoreCommerceProductMappingStore(
    firebaseAdminFirestore,
  );
export const commerceEnrollments =
  new FirestoreCommerceEnrollmentStore(
    firebaseAdminFirestore,
  );
export const commerceBindings =
  new FirestoreCommerceProviderBindingStore(
    firebaseAdminFirestore,
  );
export const commerceOrchestrator =
  new CommerceEnrollmentOrchestrator(
    commerceLedger,
    commerceMappings,
    commerceEnrollments,
    commerceBindings,
  );

export function commerceProvider(
  provider: "hotmart" | "stripe",
): CommerceProvider {
  if (provider === "hotmart") {
    return new HotmartProvider(
      process.env.HOTMART_HOTTOK ?? "",
    );
  }
  return new StripeProvider(
    process.env.STRIPE_WEBHOOK_SECRET ?? "",
  );
}

export function webhookInput(
  request: Request,
  rawBody: string,
): WebhookInput {
  return {
    rawBody,
    headers: Object.fromEntries(request.headers.entries()),
  };
}

export function commerceCorrelationId(): string {
  return randomUUID();
}
