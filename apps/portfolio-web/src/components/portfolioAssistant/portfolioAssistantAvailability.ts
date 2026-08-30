export type PortfolioAssistantAvailability = "teaser" | "active";

/**
 * Main intentionally ships a coming-soon teaser. The agent-development branch
 * switches this release gate to active for continued assistant work.
 */
export const portfolioAssistantAvailability: PortfolioAssistantAvailability = "teaser";
