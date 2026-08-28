export function jsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

export function errorResult(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: error instanceof Error ? error.message : "Portfolio data is unavailable.",
        }),
      },
    ],
  };
}
