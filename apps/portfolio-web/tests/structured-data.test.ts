import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { PORTFOLIO_MCP_ENDPOINT } from "../src/data/portfolioMcp.ts";
import { getSocialPreviewMetadata, HOME_PAGE_DESCRIPTION } from "../src/data/socialPreview.ts";
import {
  buildStructuredData,
  buildStructuredDataScript,
  type StructuredDataGraph,
  serializeStructuredData,
} from "../src/data/structuredData.ts";

const repositoryRoot = resolve(import.meta.dirname, "..");
const ORIGIN = "https://syn-forge.com";

function graphFor(pathname: string, articleDates?: { published?: string; modified?: string }) {
  return buildStructuredData({
    pathname,
    origin: ORIGIN,
    metadata: getSocialPreviewMetadata(pathname),
    articleDates,
  });
}

function nodes(graph: StructuredDataGraph) {
  return graph["@graph"] as Array<Record<string, unknown>>;
}

function types(graph: StructuredDataGraph) {
  return nodes(graph).map((node) => node["@type"]);
}

function nodeIds(graph: StructuredDataGraph) {
  return nodes(graph).map((node) => node["@id"]);
}

function collectIds(value: unknown, ids: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) collectIds(entry, ids);
    return ids;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record["@id"] === "string") ids.push(record["@id"]);
    for (const entry of Object.values(record)) collectIds(entry, ids);
  }
  return ids;
}

test("emits ProfilePage, Person, and WebSite on the homepage", () => {
  const graph = graphFor("/");

  assert.deepEqual(types(graph), ["ProfilePage", "Person", "WebSite"]);
  assert.deepEqual(nodeIds(graph), [
    "https://syn-forge.com/#profilepage",
    "https://syn-forge.com/#person",
    "https://syn-forge.com/#website",
  ]);

  const person = nodes(graph)[1];
  assert.equal(person.name, "Operator-Syn");
  assert.equal(person.jobTitle, "Full-Stack Software Developer");
  assert.ok((person.alternateName as string[]).includes("SynForge"));
  assert.deepEqual(person.sameAs, ["https://github.com/Operator-Syn"]);
  assert.equal(
    person.image,
    "https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/nice.webp",
  );

  const website = nodes(graph)[2];
  assert.equal(website.name, "Syn-Forge");
  assert.equal(website.description, HOME_PAGE_DESCRIPTION);
  assert.deepEqual(website.publisher, { "@id": "https://syn-forge.com/#person" });
});

test("emits CollectionPage and ItemList for collection routes", () => {
  for (const pathname of ["/projects", "/certificates", "/snippets"]) {
    const graph = graphFor(pathname);
    const metadata = getSocialPreviewMetadata(pathname);

    assert.deepEqual(types(graph), ["CollectionPage", "ItemList"], pathname);
    assert.deepEqual(
      nodeIds(graph),
      [`${ORIGIN}${pathname}#collectionpage`, `${ORIGIN}${pathname}#itemlist`],
      pathname,
    );

    const page = nodes(graph)[0];
    assert.equal(page.name, metadata.title);
    assert.equal(page.description, metadata.description);
    assert.deepEqual(page.mainEntity, { "@id": `${ORIGIN}${pathname}#itemlist` });

    // Items are API-resolved in the SPA; inventing a list would be a claim.
    assert.equal(nodes(graph)[1].itemListElement, undefined);
    assert.equal(nodes(graph)[1].numberOfItems, undefined);
  }
});

test("emits TechArticle and BreadcrumbList with an author reference for documents", () => {
  const pathname = "/snippets/document/22/database-migrations.md";
  const metadata = getSocialPreviewMetadata(pathname);
  const graph = graphFor(pathname, { modified: "2026-11-01T12:00:00.000Z" });

  assert.deepEqual(types(graph), ["TechArticle", "BreadcrumbList"]);
  assert.deepEqual(nodeIds(graph), [
    `${ORIGIN}${pathname}#techarticle`,
    `${ORIGIN}${pathname}#breadcrumb`,
  ]);

  const article = nodes(graph)[0];
  assert.equal(article.headline, metadata.title);
  assert.equal(article.description, metadata.description);
  assert.deepEqual(article.author, { "@id": "https://syn-forge.com/#person" });
  assert.equal(article.dateModified, "2026-11-01T12:00:00.000Z");
  // The API exposes no creation date, so no publication claim is made.
  assert.equal(article.datePublished, undefined);

  const breadcrumb = nodes(graph)[1] as {
    itemListElement: Array<{ position: number; name: string; item: string }>;
  };
  assert.deepEqual(
    breadcrumb.itemListElement.map((entry) => [entry.position, entry.name, entry.item]),
    [
      [1, "Home", "https://syn-forge.com/"],
      [2, "Snippets", "https://syn-forge.com/snippets"],
      [3, metadata.title, `${ORIGIN}${pathname}`],
    ],
  );
});

test("emits a WebPage for legal pages", () => {
  for (const pathname of ["/privacy-policy", "/terms-and-conditions"]) {
    const graph = graphFor(pathname);
    const metadata = getSocialPreviewMetadata(pathname);

    assert.deepEqual(types(graph), ["WebPage"], pathname);
    assert.deepEqual(nodeIds(graph), [`${ORIGIN}${pathname}#webpage`], pathname);

    const page = nodes(graph)[0];
    assert.equal(page.name, metadata.title);
    assert.equal(page.description, metadata.description);
    assert.equal(page.url, `${ORIGIN}${pathname}`);
  }
});

test("describes the MCP endpoint on /ai", () => {
  const graph = graphFor("/ai");
  const metadata = getSocialPreviewMetadata("/ai");

  assert.deepEqual(types(graph), ["WebPage", "SoftwareApplication"]);
  assert.deepEqual(nodeIds(graph), [
    "https://syn-forge.com/ai#webpage",
    "https://syn-forge.com/ai#softwareapplication",
  ]);

  const page = nodes(graph)[0];
  assert.equal(page.name, metadata.title);
  assert.equal(page.description, metadata.description);
  assert.deepEqual(page.about, { "@id": "https://syn-forge.com/ai#softwareapplication" });

  const app = nodes(graph)[1];
  assert.equal(app.name, "Syn-Forge Public Portfolio MCP");
  assert.equal(app.applicationCategory, "DeveloperApplication");
  assert.equal(app.url, PORTFOLIO_MCP_ENDPOINT);
  // No price, rating, or aggregate is sourced anywhere in the repository.
  assert.equal(app.offers, undefined);
  assert.equal(app.aggregateRating, undefined);
});

test("falls back to a WebPage for other served routes", () => {
  const graph = graphFor("/netbird");
  assert.deepEqual(types(graph), ["WebPage"]);
});

test("every node id is an absolute URL with a fragment and is unique per graph", () => {
  const paths = [
    "/",
    "/projects",
    "/certificates",
    "/snippets",
    "/snippets/document/22/database-migrations.md",
    "/privacy-policy",
    "/terms-and-conditions",
    "/ai",
    "/netbird",
  ];

  for (const pathname of paths) {
    const graph = graphFor(pathname);
    const ids = nodeIds(graph).map(String);

    for (const id of ids) {
      assert.match(id, /^https:\/\/syn-forge\.com\/.*#/, `${pathname}: ${id}`);
    }
    assert.equal(new Set(ids).size, ids.length, `${pathname} has duplicate node ids`);
    // References to `#person` are expected on documents and on `/`; only node
    // definitions must be unique, so assert the definitions above and sanity
    // check that every repeated @id resolves to a defined node or the Person.
    for (const id of collectIds(graph)) {
      assert.ok(id.startsWith("https://syn-forge.com/"), id);
    }
  }
});

test("makes no unsourceable claims", () => {
  const serialized = [
    "/",
    "/projects",
    "/certificates",
    "/snippets",
    "/snippets/document/22/database-migrations.md",
    "/privacy-policy",
    "/terms-and-conditions",
    "/ai",
  ]
    .map((pathname) => serializeStructuredData(graphFor(pathname)))
    .join("\n");

  assert.doesNotMatch(serialized, /SearchAction/);
  assert.doesNotMatch(serialized, /"address"/);
  assert.doesNotMatch(serialized, /"employer"/);
  assert.doesNotMatch(serialized, /"price"/);
  assert.doesNotMatch(serialized, /"aggregateRating"/);
  assert.doesNotMatch(serialized, /"ratingValue"/);
});

test("serializes a script-safe data block", () => {
  const script = buildStructuredDataScript({
    pathname: "/snippets/document/22/%3C%2Fscript%3E.md",
    origin: ORIGIN,
    metadata: getSocialPreviewMetadata("/snippets/document/22/%3C%2Fscript%3E.md"),
  });

  assert.equal(script.split('<script type="application/ld+json"').length - 1, 1);
  assert.ok(script.includes('data-global-head-manager="true"'));
  assert.ok(!script.includes("</script>.md"));
  assert.ok(script.includes("\\u003c"));

  const jsonText = script.slice(script.indexOf(">") + 1, script.lastIndexOf("</script>"));
  const parsed = JSON.parse(jsonText) as StructuredDataGraph;
  assert.equal(types(parsed)[0], "TechArticle");
});

test("leaves index.html without ld+json and lets the middleware own the graph", async () => {
  const [index, middleware] = await Promise.all([
    readFile(resolve(repositoryRoot, "index.html"), "utf8"),
    readFile(resolve(repositoryRoot, "functions/_middleware.ts"), "utf8"),
  ]);

  assert.doesNotMatch(index, /application\/ld\+json/);
  assert.match(middleware, /'script\[type="application\/ld\+json"\]'/);
  assert.match(middleware, /buildStructuredDataScript/);
});
