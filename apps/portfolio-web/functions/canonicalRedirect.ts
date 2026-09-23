export function createCanonicalRouteRedirect(requestUrl: string): Response | null {
  const source = new URL(requestUrl);
  const isLegacySnippetIndex =
    source.pathname === "/snippets/root" || source.pathname === "/snippets/root/";
  const isTrailingSlashSnippetIndex = source.pathname === "/snippets/";
  const isTrailingSlashSnippetDocument =
    source.pathname.startsWith("/snippets/document/") && source.pathname.endsWith("/");

  if (!isLegacySnippetIndex && !isTrailingSlashSnippetIndex && !isTrailingSlashSnippetDocument) {
    return null;
  }

  source.pathname = isLegacySnippetIndex ? "/snippets" : source.pathname.replace(/\/+$/, "");

  return new Response(null, {
    status: 308,
    headers: { Location: source.href },
  });
}
