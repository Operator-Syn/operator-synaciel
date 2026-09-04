import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isCredentialLikeContent,
  isSafeEnvironmentFileContent,
  isSensitiveFileName,
  isSensitivePath,
} from "../../tools/repository-mcp/src/redaction.ts";

describe("repository path redaction", () => {
  test("allows only safe environment file names", () => {
    assert.equal(isSensitiveFileName(".env.example"), false);
    assert.equal(isSensitiveFileName(".envrc"), false);
    for (const name of [".env", ".env.local", ".env.production", ".env.example.local"]) {
      assert.equal(isSensitiveFileName(name), true, name);
    }
  });

  test("allows only the guarded root .envrc content", () => {
    const safeContent = "if command -v nix >/dev/null 2>&1; then\n  use flake\nfi\n";
    assert.equal(isSensitivePath(".envrc"), false);
    assert.equal(isSensitivePath("nested/.envrc"), true);
    assert.equal(isSensitivePath(".envrc/child"), true);
    assert.equal(isSafeEnvironmentFileContent(".envrc", safeContent), true);
    assert.equal(isSafeEnvironmentFileContent(".envrc", safeContent.slice(0, -1)), true);
    assert.equal(
      isSafeEnvironmentFileContent(
        ".envrc",
        "if command -v nix >/dev/null 2>&1; then\n  use flake\n  export TOKEN=secret\nfi\n",
      ),
      false,
    );
    assert.equal(isSafeEnvironmentFileContent("nested/.envrc", safeContent), false);
    assert.equal(isSafeEnvironmentFileContent("README.md", "anything"), true);
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
