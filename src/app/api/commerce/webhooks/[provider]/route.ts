import { NextResponse } from "next/server";
import {
  enforceCommerceWebhookClientRateLimit,
  enforceCommerceWebhookProviderRateLimit,
  readCommerceWebhookBody,
} from "@/lib/commerce/webhook-security";
import {
  commerceCorrelationId,
  commerceOrchestrator,
  commerceProvider,
  webhookInput,
} from "@/lib/commerce/server";

export const runtime = "nodejs";

type ProviderName = "hotmart" | "stripe";

function providerName(value: string): ProviderName | undefined {
  return value === "hotmart" || value === "stripe"
    ? value
    : undefined;
}

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "UNKNOWN";

  if (message === "WEBHOOK_BODY_TOO_LARGE") {
    return NextResponse.json({ error: "webhook_body_too_large" }, { status: 413 });
  }

  if (message === "WEBHOOK_RATE_LIMITED") {
    return NextResponse.json(
      { error: "webhook_rate_limited" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  if (
    message.endsWith("_EVENT_UNSUPPORTED") ||
    message === "STRIPE_CHECKOUT_NOT_PAID"
  ) {
    return NextResponse.json({
      accepted: true,
      ignored: true,
      reason: message.toLowerCase(),
    });
  }

  if (
    message.includes("SIGNATURE") ||
    message === "HOTMART_HOTTOK_REQUIRED"
  ) {
    const configurationError =
      message.endsWith("_REQUIRED") &&
      !message.includes("SIGNATURE");
    return NextResponse.json(
      {
        error: configurationError
          ? "commerce_provider_not_configured"
          : "invalid_webhook_signature",
      },
      { status: configurationError ? 503 : 401 },
    );
  }

  if (
    message.includes("PAYLOAD") ||
    message.includes("IDENTITY_REQUIRED") ||
    message.includes("CREATION_DATE") ||
    message.includes("EVENT_CREATED") ||
    message.includes("VERSION_UNSUPPORTED")
  ) {
    return NextResponse.json(
      { error: "invalid_provider_event" },
      { status: 400 },
    );
  }

  if (message.includes("CONFLICT")) {
    return NextResponse.json(
      { error: "commerce_event_conflict" },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { error: "commerce_webhook_unavailable" },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await context.params;
  const provider = providerName(rawProvider);
  if (!provider) {
    return NextResponse.json(
      { error: "commerce_provider_not_found" },
      { status: 404 },
    );
  }

  try {
    enforceCommerceWebhookClientRateLimit(provider, request);
    const rawBody = await readCommerceWebhookBody(request);
    const event = await commerceProvider(provider).handleWebhook(
      webhookInput(request, rawBody),
    );
    // Signature/Hottok authentication has succeeded; only now charge the shared quota.
    enforceCommerceWebhookProviderRateLimit(provider);

    const result = await commerceOrchestrator.handle(
      event,
      commerceCorrelationId(),
    );

    return NextResponse.json(
      {
        accepted: true,
        provider,
        eventId: event.externalEventId,
        status: result.status,
        duplicate: result.duplicate,
        outcome: result.outcome ?? null,
        enrollment: result.enrollment
          ? {
              programId: result.enrollment.programId,
              status: result.enrollment.status,
            }
          : null,
      },
      {
        status:
          result.status === "processed" ? 200 : 202,
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
