import { createHash } from "node:crypto";
import type { CommerceProviderId } from "./domain";

const DEFAULT_MAX_BODY_BYTES = 256 * 1024;
const WINDOW_MS = 60_000;
const DEFAULT_CLIENT_LIMIT = 180;
const DEFAULT_PROVIDER_LIMIT = 1_500;
const MAX_BUCKETS = 2_048;

interface Bucket {
  windowStart: number;
  count: number;
}

type RateState = Map<string, Bucket>;

const shared = globalThis as typeof globalThis & {
  __lumaCommerceWebhookRateState?: RateState;
};

function rateState(): RateState {
  shared.__lumaCommerceWebhookRateState ??= new Map<string, Bucket>();
  return shared.__lumaCommerceWebhookRateState;
}

function clientFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const direct = request.headers.get("x-real-ip")?.trim();
  const raw = forwarded || direct || "unknown";
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function consumeBucket(state: RateState, key: string, nowMs: number, limit: number): boolean {
  const current = state.get(key);
  if (!current || nowMs - current.windowStart >= WINDOW_MS) {
    state.set(key, { windowStart: nowMs, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function prune(state: RateState, nowMs: number) {
  if (state.size < MAX_BUCKETS) return;
  for (const [key, bucket] of state) {
    if (nowMs - bucket.windowStart >= WINDOW_MS) state.delete(key);
  }
}

export function enforceCommerceWebhookClientRateLimit(
  provider: CommerceProviderId,
  request: Request,
  options: { nowMs?: number; clientLimit?: number } = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const state = rateState();
  prune(state, nowMs);
  const clientKey = `client:${provider}:${clientFingerprint(request)}`;
  if (!consumeBucket(state, clientKey, nowMs, options.clientLimit ?? DEFAULT_CLIENT_LIMIT)) {
    throw new Error("WEBHOOK_RATE_LIMITED");
  }
}

// Only authenticated provider events may consume the quota shared by paying clients.
export function enforceCommerceWebhookProviderRateLimit(
  provider: CommerceProviderId,
  options: { nowMs?: number; providerLimit?: number } = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const state = rateState();
  prune(state, nowMs);
  if (!consumeBucket(state, `provider:${provider}`, nowMs, options.providerLimit ?? DEFAULT_PROVIDER_LIMIT)) {
    throw new Error("WEBHOOK_RATE_LIMITED");
  }
}

export async function readCommerceWebhookBody(
  request: Request,
  maxBytes = DEFAULT_MAX_BODY_BYTES,
): Promise<string> {
  if (!Number.isFinite(maxBytes) || maxBytes < 1) throw new Error("WEBHOOK_BODY_LIMIT_INVALID");

  const declared = request.headers.get("content-length");
  if (declared) {
    const size = Number(declared);
    if (Number.isFinite(size) && size > maxBytes) throw new Error("WEBHOOK_BODY_TOO_LARGE");
  }

  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("WEBHOOK_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}
