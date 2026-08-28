import { createMcpHandler } from "agents/mcp/server";
import {
  PORTFOLIO_MCP_ALLOWED_HOSTNAMES,
  PORTFOLIO_MCP_ALLOWED_ORIGIN_HOSTNAMES,
  type PortfolioMcpEnvironment,
} from "../config.ts";
import type { PortfolioApiTransportOptions } from "../portfolio-api/index.ts";
import { createPortfolioMcpServer } from "./server.ts";

export function createPortfolioMcpHandler(
  environment: PortfolioMcpEnvironment,
  transportOptions?: PortfolioApiTransportOptions,
) {
  return createMcpHandler(() => createPortfolioMcpServer(environment, transportOptions), {
    route: "/mcp",
    allowedHostnames: PORTFOLIO_MCP_ALLOWED_HOSTNAMES,
    allowedOriginHostnames: PORTFOLIO_MCP_ALLOWED_ORIGIN_HOSTNAMES,
  });
}
