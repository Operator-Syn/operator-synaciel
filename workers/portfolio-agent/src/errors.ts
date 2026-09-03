import { MODEL_CAPACITY_MESSAGE } from "./config.ts";

type ErrorRecord = Record<string, unknown>;

function asRecord(value: unknown): ErrorRecord | null {
  return value && typeof value === "object" ? (value as ErrorRecord) : null;
}

function hasCapacityCode(record: ErrorRecord): boolean {
  const data = asRecord(record.data);
  return [record.workersAIErrorCode, record.code, data?.workersAIErrorCode, data?.code].some(
    (value) => value === 3040 || value === "3040",
  );
}

function containsCapacityMessage(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /\b3040\b|out\s+of\s+capacity|maximum(?:\s+daily)?\s+capacity|daily\s+(?:neuron|usage|request)\s+(?:limit|budget|capacity)|(?:neuron|quota).*(?:limit|budget|capacity)|capacity.*(?:limit|reached|full)/i.test(
    value,
  );
}

function isCapacityError(value: unknown, seen: Set<unknown>, depth: number): boolean {
  if (depth > 4 || seen.has(value)) return false;
  const record = asRecord(value);
  if (!record) return containsCapacityMessage(value);
  seen.add(value);
  if (hasCapacityCode(record)) return true;
  if (
    containsCapacityMessage(record.message) ||
    containsCapacityMessage(record.responseBody) ||
    containsCapacityMessage(record.statusText)
  ) {
    return true;
  }
  return isCapacityError(record.cause, seen, depth + 1);
}

/** True only for the Workers AI out-of-capacity signal or an equivalent message. */
export function isModelCapacityError(error: unknown): boolean {
  return isCapacityError(error, new Set(), 0);
}

export { MODEL_CAPACITY_MESSAGE };
