const DEFAULT_MAX_BYTES = 256_000;

export class ClassroomWebhookBodyTooLarge extends Error {
  constructor() {
    super("CLASSROOM_WEBHOOK_BODY_TOO_LARGE");
  }
}

/** Keeps unauthenticated webhook callers from buffering arbitrary-size request bodies. */
export async function readClassroomWebhookBody(
  request: Request,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<string> {
  const rawLength = request.headers.get("content-length");
  if (rawLength !== null) {
    const length = Number(rawLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
      throw new ClassroomWebhookBodyTooLarge();
    }
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new ClassroomWebhookBodyTooLarge();
    }
    chunks.push(value);
  }
  const payload = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(payload);
}
