import assert from "node:assert/strict";
import { test } from "node:test";
import type { Context } from "hono";
import type { Bindings } from "../../workers/portfolio-api/src/bindings.ts";
import { CertificateItemsController } from "../../workers/portfolio-api/src/controller/CertificatesPage/CertificateItemsController.ts";
import { ProfileController } from "../../workers/portfolio-api/src/controller/HomePage/ProfileController.ts";
import { createMediaController } from "../../workers/portfolio-api/src/controller/Media/MediaController.ts";
import { OrderingController } from "../../workers/portfolio-api/src/controller/OrderingController.ts";
import { ProjectsController } from "../../workers/portfolio-api/src/controller/ProjectPage/ProjectsController.ts";

function context(
  body: unknown,
  params: Record<string, string> = {},
  database = {},
): Context<{ Bindings: Bindings }> {
  return {
    env: { DB: database },
    req: {
      json: async () => body,
      param: (name: string) => params[name],
    },
    json(value: unknown, status = 200) {
      return Response.json(value, { status });
    },
  } as unknown as Context<{ Bindings: Bindings }>;
}

test("project writes reject unknown fields and invalid values before SQL", async () => {
  const unknownField = await ProjectsController.update(
    context({ title: "Valid", injected: "nope" }, { id: "1" }),
  );
  assert.equal((unknownField as Response).status, 400);

  const invalidType = await ProjectsController.update(context({ type: "archive" }, { id: "1" }));
  assert.equal((invalidType as Response).status, 400);

  const invalidId = await ProjectsController.delete(context({}, { id: "0" }));
  assert.equal((invalidId as Response).status, 400);
});

test("project facets accept only bounded string arrays and normalize tokens", async () => {
  const baseProject = {
    title: "Facet project",
    type: "image",
    url: "https://example.com/project.png",
    short_description: "Short summary",
    long_description: "Long description",
    project_link: "https://example.com/project",
  };

  for (const facets of [
    { categories: "client-website" },
    { stack: ["ok", 2] },
    { highlights: ["x".repeat(161)] },
    { categories: Array.from({ length: 7 }, (_, index) => `tag-${index}`) },
    { stack: Array.from({ length: 13 }, (_, index) => `tool-${index}`) },
    { stack: ["x".repeat(49)] },
  ]) {
    const response = await ProjectsController.create(context({ ...baseProject, ...facets }));
    assert.equal((response as Response).status, 400);
  }

  const statements: Array<{ query: string; values: unknown[] }> = [];
  const row = {
    id: 1,
    ...baseProject,
    categories: '["client-website","fintech"]',
    stack: '["next.js"]',
    highlights: '["Loan calculators"]',
    display_order: 0,
    created_at: "2026-08-27T00:00:00.000Z",
  };
  const database = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          statements.push({ query, values });
          return {
            first: async () => ({ id: 1 }),
            all: async () => ({ results: [row] }),
            run: async () => undefined,
          };
        },
      };
    },
  };

  const response = await ProjectsController.create(
    context(
      {
        ...baseProject,
        categories: ["Client Website", "client-website", " FinTech "],
        stack: ["Next.js"],
        highlights: [" Loan calculators ", "Loan calculators"],
      },
      {},
      database,
    ),
  );
  assert.equal((response as Response).status, 201);
  const insert = statements.find((statement) => statement.query.includes("INSERT INTO Projects"));
  assert.deepEqual(insert?.values.slice(6, 9), [
    '["client-website","fintech"]',
    '["next.js"]',
    '["Loan calculators"]',
  ]);

  const updateResponse = await ProjectsController.update(
    context({ title: "Renamed" }, { id: "1" }, database),
  );
  assert.equal((updateResponse as Response).status, 200);
  const update = statements.find((statement) => statement.query.startsWith("UPDATE Projects"));
  assert.deepEqual(update?.values, ["Renamed", 1]);

  const facetUpdateResponse = await ProjectsController.update(
    context({ categories: ["Client Website"] }, { id: "1" }, database),
  );
  assert.equal((facetUpdateResponse as Response).status, 200);
  const facetUpdate = statements
    .filter((statement) => statement.query.startsWith("UPDATE Projects"))
    .at(-1);
  assert.deepEqual(facetUpdate?.values, ['["client-website"]', 1]);
});

test("public project reads expose facets", async () => {
  const row = {
    id: 1,
    title: "Facet project",
    type: "image",
    url: "https://example.com/project.png",
    short_description: "Short summary",
    long_description: "Long description",
    project_link: "https://example.com/project",
    categories: '["client-website","fintech"]',
    stack: '["next.js"]',
    highlights: '["Loan calculators"]',
    display_order: 0,
    created_at: "2026-08-27T00:00:00.000Z",
  };
  const database = {
    prepare() {
      return {
        all: async () => ({ results: [row] }),
        bind: () => ({ all: async () => ({ results: [row] }) }),
      };
    },
  };

  const listResponse = await ProjectsController.list(context({}, {}, database));
  const list = (await (listResponse as Response).json()) as Array<Record<string, unknown>>;
  assert.deepEqual(list[0]?.categories, ["client-website", "fintech"]);
  assert.deepEqual(list[0]?.stack, ["next.js"]);
  assert.deepEqual(list[0]?.highlights, ["Loan calculators"]);

  const getResponse = await ProjectsController.get(context({}, { id: "1" }, database));
  const project = (await (getResponse as Response).json()) as Record<string, unknown>;
  assert.deepEqual(project.categories, ["client-website", "fintech"]);
  assert.deepEqual(project.stack, ["next.js"]);
  assert.deepEqual(project.highlights, ["Loan calculators"]);
});

test("profile and certificate-item writes reject coerced object values", async () => {
  const profile = await ProfileController.updateById(
    context({ value: { secret: "object" } }, { id: "1" }),
  );
  assert.equal((profile as Response).status, 400);

  const item = await CertificateItemsController.create(
    context({ project_id: 1, type: "image", url: "", display_order: 0 }),
  );
  assert.equal((item as Response).status, 400);

  const invalidItemId = await CertificateItemsController.update(
    context({ url: "https://example.com/item" }, { id: "1.5" }),
  );
  assert.equal((invalidItemId as Response).status, 400);
});

test("ordering accepts only numeric unique IDs and batches updates", async () => {
  const invalidDatabase = {
    prepare() {
      throw new Error("database should not be read for invalid payload");
    },
  };
  const invalid = await OrderingController.projects(
    context({ items: [{ id: "1", display_order: 0 }] }, {}, invalidDatabase),
  );
  assert.equal((invalid as Response).status, 400);

  let batchCalls = 0;
  const database = {
    prepare() {
      return {
        bind: (...args: unknown[]) => ({
          all: async () => ({ results: args.map((id) => ({ id })) }),
        }),
      };
    },
    async batch() {
      batchCalls += 1;
      return [];
    },
  };
  const ordered = await OrderingController.projects(
    context(
      {
        items: [
          { id: 1, display_order: 0 },
          { id: 2, display_order: 1 },
        ],
      },
      {},
      database,
    ),
  );
  assert.equal((ordered as Response).status, 200);
  assert.equal(batchCalls, 1);
});

test("media keys cannot escape their controller prefix", async () => {
  const controller = createMediaController("Projects/");
  const response = await controller.get(
    context({}, { key: "Certificates/other.mp4" }, { BUCKET: {} }),
  );
  assert.equal((response as Response).status, 400);
});
