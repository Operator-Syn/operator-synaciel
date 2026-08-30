export type PortfolioAssistantAvailability = "teaser" | "active";

/**
 * The agent-development branch keeps the authenticated assistant active for
 * continued chat work; main pins this gate to the teaser state.
 */
export const portfolioAssistantAvailability: PortfolioAssistantAvailability = "active";
