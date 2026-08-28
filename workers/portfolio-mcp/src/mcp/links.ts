export function getPortfolioPageUrl(kind: "project" | "certificate"): string {
  return `https://syn-forge.com/${kind === "project" ? "projects" : "certificates"}`;
}
