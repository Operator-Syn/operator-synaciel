import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const appRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");

test("keeps Pages verification metadata in the web workspace public assets", async () => {
  const verificationFile = await readFile(resolve(appRoot, "public/.well-known/discord"), "utf8");

  assert.match(verificationFile.trim(), /^dh=[a-f0-9]+$/);
});
