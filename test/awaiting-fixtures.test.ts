import { parsePrompt } from "@fungi.computer/whistle/wire";
import { expect, it } from "vitest";

import { awaitingFixtures } from "../src/index.js";

it("holds every moment a renderer must draw, each a valid decision prompt", () => {
  expect(awaitingFixtures.map((fixture) => fixture.name)).toEqual([
    "single",
    "multiple toggled",
    "other typing",
    "2 of 3",
    "sending",
    "refused",
    "approval",
    "approval confirm",
    "approval refused",
  ]);
  for (const fixture of awaitingFixtures) {
    expect(parsePrompt(fixture.prompt)).toEqual(fixture.prompt);
    expect(fixture.position).toBeLessThanOrEqual(fixture.total);
  }
});
