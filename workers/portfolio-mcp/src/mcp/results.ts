import { PortfolioApiError } from "../portfolio-api/errors.ts";

type PublicErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "RATE_LIMITED" | "INTERNAL_ERROR";

function classifyError(error: unknown): { code: PublicErrorCode; message: string } {
  if (!(error instanceof PortfolioApiError)) {
    return {
      code: "INTERNAL_ERROR",
      message: "Portfolio data is temporarily unavailable.",
    };
  }

  if (error.status === 400 || error.status === 413) {
    return {
      code: "INVALID_INPUT",
      message:
        error.status === 413
          ? "The requested portfolio document is too large."
          : "The portfolio request was invalid.",
    };
  }

  if (error.status === 404) {
    return {
      code: "NOT_FOUND",
      message: "The requested portfolio item was not found.",
    };
  }

  if (error.status === 429) {
    return {
      code: "RATE_LIMITED",
      message: "Portfolio requests are temporarily rate limited.",
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Portfolio data is temporarily unavailable.",
  };
}

export function jsonResult<T>(value: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

export function errorResult(error: unknown) {
  const classified = classifyError(error);

  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(classified),
      },
    ],
  };
}
