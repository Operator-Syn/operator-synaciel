import assert from "node:assert/strict";
import { test } from "node:test";
import type { D1Database } from "@cloudflare/workers-types";
import { SectionItemsModel } from "../../workers/portfolio-api/src/model/HomePage/SectionItemsModel.ts";

function createCapturingDatabase() {
  let boundValues: unknown[] = [];

  const database = {
    prepare() {
      return {
        bind(...values: unknown[]) {
          boundValues = values;
          return {
            async first() {
              return null;
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  return {
    database,
    getBoundValues: () => boundValues,
  };
}

test("normalizes section item URLs before creating and updating records", async () => {
  const imageUrl = "https://img.shields.io/badge/Vite-B73BFE";
  const targetUrl = "https://vite.dev/";

  const createDatabase = createCapturingDatabase();
  const createModel = new SectionItemsModel(createDatabase.database);
  await createModel.create(4, "Vite", null, `\t${imageUrl}`, ` ${targetUrl}\n`, 1);

  assert.equal(createDatabase.getBoundValues()[3], imageUrl);
  assert.equal(createDatabase.getBoundValues()[4], targetUrl);

  const updateDatabase = createCapturingDatabase();
  const updateModel = new SectionItemsModel(updateDatabase.database);
  await updateModel.update(46, "Vite", null, `\t${imageUrl}`, ` ${targetUrl}\n`, 1);

  assert.equal(updateDatabase.getBoundValues()[2], imageUrl);
  assert.equal(updateDatabase.getBoundValues()[3], targetUrl);
});
