import type { ExportedHandler } from "@cloudflare/workers-types";
import type { PortfolioMcpEnvironment } from "./config.ts";
import { createPortfolioMcpHandler } from "./mcp/handler.ts";

type WorkerFetchHandler = NonNullable<ExportedHandler<PortfolioMcpEnvironment>["fetch"]>;
type WorkerRequest = Parameters<WorkerFetchHandler>[0];
type WorkerEnvironment = Parameters<WorkerFetchHandler>[1];
type WorkerContext = Parameters<WorkerFetchHandler>[2];

const worker = {
  fetch(request: WorkerRequest, environment: WorkerEnvironment, context: WorkerContext) {
    const handler = createPortfolioMcpHandler(environment, {
      cache: (caches as typeof caches & { default: Cache }).default,
      waitUntil: (promise) => context.waitUntil(promise),
    });
    return handler(
      request as unknown as Parameters<typeof handler>[0],
      environment as unknown as Parameters<typeof handler>[1],
      context as unknown as Parameters<typeof handler>[2],
    ) as unknown as ReturnType<WorkerFetchHandler>;
  },
} satisfies ExportedHandler<PortfolioMcpEnvironment>;

export default worker;
