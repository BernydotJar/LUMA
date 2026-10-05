export function sanitizePreferredName(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

export function firstDisplayName(value: string | null | undefined, fallback = "Participante") {
  const clean = sanitizePreferredName(value || "");
  return clean.split(/\s+/)[0] || fallback;
}
