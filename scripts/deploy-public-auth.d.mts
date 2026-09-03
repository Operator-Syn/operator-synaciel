export type PublicAuthInvocation = {
  readonly args: readonly string[];
  readonly input: string;
};

export function buildMigrationInvocation(): PublicAuthInvocation;
export function shouldApplyMigration(args?: readonly string[]): boolean;
export function buildDeploymentInvocation(args?: readonly string[]): PublicAuthInvocation;
export function runWrangler(invocation: PublicAuthInvocation): Promise<void>;
export function deployPublicAuth(
  args?: readonly string[],
  run?: (invocation: PublicAuthInvocation) => Promise<void>,
): Promise<void>;
