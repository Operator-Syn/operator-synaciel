import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_HERO_KICKER, getHeroCopy, HOME_ROLE_LINE } from "../src/data/homeHeroCopy";

/**
 * The home hero's heading is a role statement and must not depend on the API; the
 * kicker is where the owner's tagline still lands. These cases cover the branches
 * the panel actually encounters: the live phrase, a phrase without the separator,
 * an empty phrase, and a missing field.
 */

test("splits the owner's phrase into a tagline kicker under the role heading", () => {
  const copy = getHeroCopy({
    headerPhrase: "Calm Interfaces, Seamless Experiences — Welcome Visitors! ",
  });

  assert.equal(copy.title, HOME_ROLE_LINE);
  assert.equal(copy.kicker, "Calm Interfaces, Seamless Experiences");
});

test("uses the whole phrase as the kicker when there is no separator", () => {
  const copy = getHeroCopy({ headerPhrase: "  Building small, sharp tools  " });

  assert.equal(copy.title, HOME_ROLE_LINE);
  assert.equal(copy.kicker, "Building small, sharp tools");
});

test("falls back to the mobile phrase, then the default", () => {
  assert.equal(
    getHeroCopy({ headerPhrase: "   ", mobileHeaderPhrase: "Mobile hello" }).kicker,
    "Mobile hello",
  );
  assert.equal(getHeroCopy({}).kicker, DEFAULT_HERO_KICKER);
  assert.equal(getHeroCopy({ headerPhrase: " — " }).kicker, DEFAULT_HERO_KICKER);
});

test("the heading is the role line in every branch", () => {
  const inputs = [
    {},
    { headerPhrase: "" },
    { headerPhrase: "No separator here" },
    { headerPhrase: "Tagline — Greeting" },
  ];

  for (const site of inputs) {
    assert.equal(getHeroCopy(site).title, HOME_ROLE_LINE);
  }

  assert.match(HOME_ROLE_LINE, /software developer/i);
});
