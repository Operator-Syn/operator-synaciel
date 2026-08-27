import assert from "node:assert/strict";
import { test } from "node:test";
import { redactSensitiveLogText } from "../src/utils/serverErrors.ts";

test("redacts bearer credentials and sensitive URL query values", () => {
  const message =
    "PUT https://storage.example/object?X-Amz-Credential=access-key&X-Amz-Signature=signed-value&code=oauth-code Authorization: Bearer access-token";

  const redacted = redactSensitiveLogText(message);

  assert.doesNotMatch(redacted, /access-key|signed-value|oauth-code|access-token/);
  assert.match(redacted, /X-Amz-Credential=<REDACTED>/);
  assert.match(redacted, /X-Amz-Signature=<REDACTED>/);
  assert.match(redacted, /code=<REDACTED>/);
  assert.match(redacted, /Authorization: Bearer <REDACTED>/);
});
