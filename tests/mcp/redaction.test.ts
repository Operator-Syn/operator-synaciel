import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isCredentialLikeContent } from "../../mcp/redaction.ts";

describe("credential-like content detection", () => {
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
