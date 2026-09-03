import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isCredentialLikeContent,
  isSensitiveFileName,
} from "../../tools/repository-mcp/src/redaction.ts";

describe("repository path redaction", () => {
  test("allows only the safe environment template name", () => {
    assert.equal(isSensitiveFileName(".env.example"), false);
    for (const name of [".env", ".env.local", ".env.production", ".env.example.local"]) {
      assert.equal(isSensitiveFileName(name), true, name);
    }
  });

  test("does not flag TypeScript binding type declarations", () => {
    const bindingName = ["R2", "SECRET", "ACCESS", "KEY"].join("_");
    assert.equal(isCredentialLikeContent(`${bindingName}: string;`), false);
  });

  test("does not flag empty secret-like initializers", () => {
    assert.equal(isCredentialLikeContent("WRITTEN_SECRET=() # shell array"), false);
  });

  test("flags secret-like assignments", () => {
    const bindingName = ["R2", "SECRET", "ACCESS", "KEY"].join("_");
    assert.equal(isCredentialLikeContent(`${bindingName}=runtime-value`), true);
  });
});
