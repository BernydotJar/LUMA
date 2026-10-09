import { describe, expect, it } from "vitest";
import { isCommerceProviderConfigurationError } from "./webhook-errors";

describe("commerce webhook configuration diagnostics", () => {
  it.each(["STRIPE_WEBHOOK_SECRET_REQUIRED", "HOTMART_HOTTOK_REQUIRED"])
  ("classifies %s as a provider configuration error (503)", (message) => {
    expect(isCommerceProviderConfigurationError(message)).toBe(true);
  });
  it.each(["STRIPE_SIGNATURE_REQUIRED", "STRIPE_SIGNATURE_INVALID",
    "HOTMART_SIGNATURE_INVALID", "STRIPE_PAYLOAD_INVALID"])
  ("does not misclassify %s as a missing server secret", (message) => {
    expect(isCommerceProviderConfigurationError(message)).toBe(false);
  });
});
