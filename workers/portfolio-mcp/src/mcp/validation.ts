export function safeLimit(value: number | undefined, fallback: number, maximum: number): number {
  return Math.min(Math.max(Math.floor(value ?? fallback), 1), maximum);
}

export function safeId(value: number): number {
  return Math.floor(value);
}
