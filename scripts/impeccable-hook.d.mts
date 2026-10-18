export function extractAdditionalContext(rawOutput: unknown): string;

export function deferredContextPath(input: unknown, queueDirectory?: string): string;

export function readDeferredContext(input: unknown, queueDirectory?: string): string[];

export function queueDeferredContext(
  input: unknown,
  rawOutput: unknown,
  queueDirectory?: string,
): string;

export function clearDeferredContext(input: unknown, queueDirectory?: string): void;

export function buildStopOutput(
  input: unknown,
  stopOutput: unknown,
  queueDirectory?: string,
): string;

export function runImpeccableHook(
  rawInput: string,
  options?: {
    readonly spawn?: (
      command: string,
      argumentsList: readonly string[],
      options: {
        readonly input: string;
        readonly encoding: "utf8";
        readonly timeout: number;
        readonly maxBuffer: number;
        readonly shell: false;
      },
    ) => { readonly stdout?: string };
    readonly timeout?: number;
  },
): string;
