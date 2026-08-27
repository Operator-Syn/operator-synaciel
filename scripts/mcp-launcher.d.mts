export type McpLaunchMode = 'repository' | 'graphify';

export type McpLaunchSpec = {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly required: readonly {
    readonly path: string;
    readonly message: string;
    readonly executable?: boolean;
  }[];
};

export function resolveRepositoryRoot(options?: {
  readonly anchor?: string;
  readonly launcher?: string;
}): string;
export function buildLaunchSpec(root: string, mode: McpLaunchMode): McpLaunchSpec;
export function launch(mode: McpLaunchMode): void;
