/** Deployment-secret failures must not be treated like invalid client signatures. */
export function isCommerceProviderConfigurationError(message: string): boolean {
  return message === "STRIPE_WEBHOOK_SECRET_REQUIRED" ||
    message === "HOTMART_HOTTOK_REQUIRED";
}
