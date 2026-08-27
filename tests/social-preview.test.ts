import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  getSocialPreviewImagePath,
  getSocialPreviewImageUrl,
  getSocialPreviewMetadata,
  normalizeSocialPreviewPath,
  SOCIAL_PREVIEW_ROUTES,
} from "../src/data/socialPreview.ts";

const repositoryRoot = resolve(import.meta.dirname, "..");

test("normalizes route paths and falls back safely", () => {
  assert.equal(normalizeSocialPreviewPath("projects/?source=share"), "/projects");
  assert.equal(normalizeSocialPreviewPath("/"), "/");
  assert.equal(normalizeSocialPreviewPath(""), "/");
  assert.equal(getSocialPreviewMetadata("/unknown").route, "home");
  assert.equal(getSocialPreviewMetadata("/").routeIndex, "01 / 08");
  assert.equal(getSocialPreviewMetadata("/projects").routeIndex, "02 / 08");
  assert.equal(getSocialPreviewMetadata("/unknown").routeIndex, "01 / 08");
  assert.equal(
    getSocialPreviewMetadata("/snippets/document/22/database-migrations.md").route,
    "snippets",
  );
});

test("creates distinct top-level image URLs", () => {
  const imageUrls = SOCIAL_PREVIEW_ROUTES.map((route) => getSocialPreviewImageUrl(route.pathname));

  assert.equal(new Set(imageUrls).size, SOCIAL_PREVIEW_ROUTES.length);
  assert.equal(getSocialPreviewImagePath("/"), "/social-image.png");
  assert.equal(getSocialPreviewImagePath("/projects/"), "/projects/social-image.png");
  assert.equal(
    getSocialPreviewImageUrl("/projects/"),
    "https://syn-forge.com/projects/social-image.png",
  );
});

test("keeps route metadata grounded in existing public copy", async () => {
  const sourcePaths = [
    "index.html",
    "src/components/pages/homePage/Home.tsx",
    "src/components/pages/projectsPage/Projects.tsx",
    "src/components/pages/certificatesPage/Certificates.tsx",
    "src/components/pages/snippetsPage/Snippets.tsx",
    "src/components/pages/privacyPolicyPage/PrivacyPolicy.tsx",
    "src/components/pages/termsAndConditionsPage/TermsAndConditions.tsx",
    "src/components/pages/netbirdPage/Netbird.tsx",
    "src/components/pages/atelierPage/Atelier.tsx",
  ];

  const sources = await Promise.all(
    sourcePaths.map((path) => readFile(resolve(repositoryRoot, path), "utf8")),
  );

  assert.match(sources[0], /https:\/\/syn-forge\.com\/social-image\.png/);
  for (const source of sources) {
    assert.doesNotMatch(source, /ProfilePicture\/preview\.png/);
  }
});

test("keeps Pages image generation and crawler rewriting in the Pages boundary", async () => {
  const [middleware, routes] = await Promise.all([
    readFile(resolve(repositoryRoot, "functions/_middleware.ts"), "utf8"),
    readFile(resolve(repositoryRoot, "public/_routes.json"), "utf8"),
  ]);

  assert.match(middleware, /ImageResponse/);
  assert.match(middleware, /HTMLRewriter/);
  assert.match(middleware, /SOCIAL_PREVIEW_IMAGE_SUFFIX/);
  assert.match(middleware, /metadata\.routeIndex/);
  assert.match(middleware, /Working archive/);

  const routesConfig = JSON.parse(routes);
  assert.ok(routesConfig.include.includes("/social-image.png"));
  assert.ok(routesConfig.include.includes("/projects/*"));
  assert.ok(routesConfig.exclude.includes("/assets/*"));
});
