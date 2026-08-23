export type McpConfigCheck = {
  readonly ok: boolean;
  readonly errors: readonly string[];
};

export function checkMcpConfig(): Promise<McpConfigCheck>;
