import { createMcpHandler } from "agents/mcp/server";
import {
  PORTFOLIO_MCP_ALLOWED_HOSTNAMES,
  PORTFOLIO_MCP_ALLOWED_ORIGIN_HOSTNAMES,
  type PortfolioMcpEnvironment,
} from "../config.ts";
import { createPortfolioMcpServer } from "./server.ts";

export function createPortfolioMcpHandler(environment: PortfolioMcpEnvironment) {
  return createMcpHandler(() => createPortfolioMcpServer(environment), {
    route: "/mcp",
    allowedHostnames: PORTFOLIO_MCP_ALLOWED_HOSTNAMES,
    allowedOriginHostnames: PORTFOLIO_MCP_ALLOWED_ORIGIN_HOSTNAMES,
  });
}
