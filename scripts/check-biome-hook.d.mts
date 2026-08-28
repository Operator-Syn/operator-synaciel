export const BIOME_CHECK_COMMAND: readonly string[];
export const MAX_FEEDBACK_CHARS: number;

export type BiomeCheckResult = {
  readonly status: number;
  readonly output: string;
};

export type BiomeHookFeedback = {
  readonly decision: "block";
  readonly reason: string;
  readonly hookSpecificOutput: {
    readonly hookEventName: "PostToolUse";
    readonly additionalContext: string;
  };
};

type BiomeSpawn = (
  command: string,
  argumentsList: readonly string[],
  options: {
    readonly cwd: string;
    readonly encoding: "utf8";
  },
) => {
  readonly status: number | null;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly error?: Error;
};

export function runBiomeCheck(options?: {
  readonly cwd?: string;
  readonly spawn?: BiomeSpawn;
}): BiomeCheckResult;

export function buildBiomeHookFeedback(input: {
  readonly toolName?: unknown;
  readonly output?: unknown;
}): BiomeHookFeedback;
