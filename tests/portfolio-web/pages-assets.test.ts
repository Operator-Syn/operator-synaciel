import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const appRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");

test("keeps Pages verification metadata in the web workspace public assets", async () => {
  const verificationFile = await readFile(resolve(appRoot, "public/.well-known/discord"), "utf8");

  assert.match(verificationFile.trim(), /^dh=[a-f0-9]+$/);
});

test("keeps the agent discovery identity and static asset route stable", async () => {
  const [llms, routes] = await Promise.all([
    readFile(resolve(appRoot, "public/llms.txt"), "utf8"),
    readFile(resolve(appRoot, "public/_routes.json"), "utf8"),
  ]);

  assert.match(llms, /^Syn-Forge is the software developer portfolio of Operator-Syn\.$/m);
  assert.doesNotMatch(llms, /John-Ronan/);

  const routesConfig = JSON.parse(routes) as {
    include: string[];
    exclude: string[];
  };
  assert.ok(routesConfig.include.includes("/ai"));
  assert.ok(routesConfig.exclude.includes("/llms.txt"));
});
