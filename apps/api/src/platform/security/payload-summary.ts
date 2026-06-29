const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(password|token|secret|authorization|cookie|signature|refresh)/i;
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 240;
const MAX_JSON_LENGTH = 2_000;

export function toSafePayloadSummary(value: unknown) {
  if (value === undefined) {
    return null;
  }

  const sanitized = sanitizeValue(value, 0);
  const serialized = JSON.stringify(sanitized);

  if (!serialized) {
    return null;
  }

  return serialized.length > MAX_JSON_LENGTH
    ? `${serialized.slice(0, MAX_JSON_LENGTH - 3)}...`
    : serialized;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (depth >= MAX_DEPTH) {
    return "[TRUNCATED]";
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH - 3)}...`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).slice(0, 20).map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeValue(entryValue, depth + 1)
      ])
    );
  }

  return String(value);
}
