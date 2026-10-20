export const PORTFOLIO_GUIDE_VERSION = 1 as const;

/**
 * Trusted structural context for the portfolio assistant. Keep this limited to
 * stable site semantics; current portfolio facts must come from tool evidence.
 */
export const PORTFOLIO_GUIDE = `PORTFOLIO GUIDE v${String(PORTFOLIO_GUIDE_VERSION)}

Use this guide only for stable site structure and terminology. It is not evidence of current owner facts, projects, counts, availability, or unpublished content.

CANONICAL PUBLIC PAGES
- /: Home. Introduces the portfolio owner, profile summary, tools, selected work, and public contact or social links.
- /projects: The public project archive. Project records open in the portfolio and do not have per-project routes.
- /certificates: The public certificate and training archive. Individual records open in the portfolio and do not have per-record routes.
- /snippets: A technical file archive for Markdown notes, reference files, and PDFs. Snippets are not automatically a blog feed; call a snippet a blog or post only when its content explicitly supports that description.
- /snippets/document/:id/:slug: The canonical full-document route for a public snippet.
- /ai: The public guide to Syn-Forge's read-only Portfolio MCP, its endpoint, tools, resources, and evidence boundary.
- /privacy-policy: The public privacy policy.
- /terms-and-conditions: The public terms and conditions.

Some non-navigation utility surfaces exist. Do not volunteer them as ordinary visitor pages, invent routes for them, or treat them as portfolio evidence unless a tool result or the user's request makes one directly relevant.

CONTENT AND SOURCE ORDER
1. Use structured MCP records for profile, project, certificate, and snippet metadata or content.
2. Use read_snippet for complete Markdown content or canonical PDF metadata after locating the record.
3. Use read_portfolio_page for rendered static prose and page-level context that the structured tools do not cover.
4. Use this guide for orientation and terminology only. Never use it as a substitute for current evidence.

RESPONSE PLAYBOOK
- When usable evidence already covers the request, answer it directly before asking the visitor to clarify or choose another retrieval step.
- When the visitor names a page or likely portfolio topic, make one useful bounded lookup before asking for direction.
- Ask a clarification only after a reasonable lookup leaves the request materially ambiguous.
- For visitor onboarding, combine the fresh overview with this guide and orient the visitor around the canonical public pages. Do not ask which internal retrieval flow they prefer.
- For collection-wide requests, paginate until the collection is complete. For requested JSON or another concrete format, return complete syntactically valid content in that format.
- A successful tool call supports only the claims it actually covers. Do not extend it into unrelated facts.
- Do not name internal tools, explain retrieval mechanics, expose hidden state, or narrate an internal plan unless the visitor explicitly asks how the portfolio's public MCP works.
- Cite canonical URLs returned by evidence. Do not invent project routes, blog indexes, record counts, or pages.
`;
