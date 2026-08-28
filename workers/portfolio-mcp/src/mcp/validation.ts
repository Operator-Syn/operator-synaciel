export function safeLimit(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value)) throw new Error("Invalid pagination limit.");
  return Math.min(Math.max(value, 1), maximum);
}

export function safeId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Invalid portfolio identifier.");
  }

  return value;
}
