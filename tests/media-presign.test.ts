import assert from "node:assert/strict";
import { test } from "node:test";
import type { Context } from "hono";
import type { Bindings } from "../src/Api.ts";
import { createMediaController } from "../src/controller/Media/MediaController.ts";

type PresignResult = {
  body: unknown;
  status?: number;
};

test("presigned media PUT URLs do not bind an empty automatic checksum", async () => {
  const controller = createMediaController("Projects/");
  const responseHeaders = new Map<string, string>();
  const accessKeyName = ["R2", "ACCESS", "KEY", "ID"].join("_");
  const secretKeyName = ["R2", "SECRET", "ACCESS", "KEY"].join("_");
  const context = {
    env: {
      ACCOUNT_ID: "00000000000000000000000000000000",
      [accessKeyName]: "",
      [secretKeyName]: "",
      R2_BUCKET_NAME: "test-bucket",
      VITE_CDN_URL: "https://cdn.example.com",
    },
    req: {
      json: async () => ({ filename: "screenshot.png", contentType: "image/png" }),
    },
    header(name: string, value: string) {
      responseHeaders.set(name, value);
    },
    json(body: unknown, status?: number) {
      return { body, status } satisfies PresignResult;
    },
  } as unknown as Context<{ Bindings: Bindings }>;

  const result = (await controller.presign(context)) as unknown as PresignResult;
  assert.equal(result.status, undefined);
  assert.equal(responseHeaders.get("Cache-Control"), "no-store");

  const payload = result.body as { success: boolean; uploadUrl: string; key: string };
  const uploadUrl = new URL(payload.uploadUrl);

  assert.equal(payload.success, true);
  assert.match(payload.key, /^Projects\/[0-9a-f-]+-screenshot\.png$/);
  assert.equal(uploadUrl.searchParams.get("X-Amz-Expires"), "300");
  assert.equal(uploadUrl.searchParams.get("x-amz-sdk-checksum-algorithm"), null);
  assert.equal(uploadUrl.searchParams.get("x-amz-checksum-crc32"), null);
});
