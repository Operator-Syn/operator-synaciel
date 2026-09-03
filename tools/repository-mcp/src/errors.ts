export const REPOSITORY_REASON_CODES = [
  "PROFILE_DENIED",
  "READ_PERMISSION_REQUIRED",
  "HASH_MISMATCH",
  "PLAN_UNAVAILABLE",
  "REVIEW_HASH_MISMATCH",
  "ANCHOR_NOT_FOUND",
  "AMBIGUOUS_EDIT",
  "OVERLAPPING_EDIT",
  "CONTENT_GUARD_REJECTED",
  "LINE_RANGE_INVALID",
  "LINE_TOO_LONG",
  "SEARCH_LIMIT_REACHED",
  "VERIFICATION_FAILED",
  "APPLY_ROLLED_BACK",
  "INVALID_REQUEST",
  "INTERNAL_ERROR",
] as const;

export type RepositoryReasonCode = (typeof REPOSITORY_REASON_CODES)[number];

export type RepositoryNextAction = {
  readonly tool: string;
};

export class RepositoryDomainError extends Error {
  readonly reasonCode: RepositoryReasonCode;
  readonly retryable: boolean;
  readonly nextAction?: RepositoryNextAction;
  readonly conflicts?: readonly {
    readonly path: string;
    readonly expectedSha256?: string | null;
    readonly currentSha256?: string | null;
  }[];

  constructor(
    message: string,
    reasonCode: RepositoryReasonCode,
    options: {
      readonly retryable?: boolean;
      readonly nextAction?: RepositoryNextAction;
      readonly conflicts?: readonly {
        readonly path: string;
        readonly expectedSha256?: string | null;
        readonly currentSha256?: string | null;
      }[];
    } = {},
  ) {
    super(message);
    this.name = "RepositoryDomainError";
    this.reasonCode = reasonCode;
    this.retryable = options.retryable ?? false;
    this.nextAction = options.nextAction;
    this.conflicts = options.conflicts;
  }
}

export type RepositoryFailure = {
  readonly reasonCode: RepositoryReasonCode;
  readonly retryable: boolean;
  readonly nextAction?: RepositoryNextAction;
  readonly conflicts?: readonly {
    readonly path: string;
    readonly expectedSha256?: string | null;
    readonly currentSha256?: string | null;
  }[];
};

export function repositoryFailure(error: unknown): RepositoryFailure {
  if (error instanceof RepositoryDomainError) {
    return {
      reasonCode: error.reasonCode,
      retryable: error.retryable,
      ...(error.nextAction ? { nextAction: error.nextAction } : {}),
      ...(error.conflicts ? { conflicts: error.conflicts } : {}),
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/not allowed by .* read profile/i.test(message)) {
    return {
      reasonCode: "PROFILE_DENIED",
      retryable: false,
    };
  }
  if (/permission|grant_repository_read_access/i.test(message)) {
    return {
      reasonCode: "READ_PERMISSION_REQUIRED",
      retryable: true,
      nextAction: { tool: "grant_repository_read_access" },
    };
  }
  if (/profile|not allowed by/i.test(message)) {
    return {
      reasonCode: "PROFILE_DENIED",
      retryable: false,
    };
  }
  if (/hash does not match|stale|collaborator changes/i.test(message)) {
    return {
      reasonCode: "HASH_MISMATCH",
      retryable: true,
      nextAction: { tool: "read_repository_files" },
    };
  }
  if (
    /line range|line mode|operation.*require|must omit|description is required|at most|targets must/i.test(
      message,
    )
  ) {
    return {
      reasonCode: "INVALID_REQUEST",
      retryable: false,
    };
  }
  if (/binary|credential|sensitive/i.test(message)) {
    return {
      reasonCode: "CONTENT_GUARD_REJECTED",
      retryable: false,
    };
  }
  return {
    reasonCode: "INTERNAL_ERROR",
    retryable: false,
  };
}

export function failureFields(error: unknown): RepositoryFailure {
  return repositoryFailure(error);
}
