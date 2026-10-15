import { describe, expect, it } from "vitest";
import {
  gardenCall,
  gardenCatalog,
  gardenExtensionId,
  gardenSlots,
  slashParityCases,
  slashParityFlow,
} from "../src/index.js";

describe("garden extension fixture", () => {
  it("rosters one running slot naming the garden catalog", () => {
    const slots = gardenSlots();
    expect(Object.keys(slots)).toEqual([gardenExtensionId]);
    expect(slots[gardenExtensionId]?.status).toBe("running");
  });

  it("advertises /water through the catalog's slash projection", () => {
    const [command] = gardenCatalog.commands;
    expect(command?.id).toBe("water");
    expect(command?.projections?.slash?.aliases).toContain("water");
  });

  it("asks which bed when none is given, then reports success", async () => {
    const asked = await gardenCall("water", {});
    expect(asked).toMatchObject({ type: "prompt" });
    const done = await gardenCall("water", { bed: "fern" });
    expect(done).toMatchObject({
      type: "done",
      notice: { message: "Watered the fern bed." },
    });
  });

  it("rejects an unknown command", async () => {
    await expect(gardenCall("dig", {})).rejects.toThrow(
      "Unknown garden command dig",
    );
  });

  it("matches the slash-parity flow it hands every renderer", () => {
    expect(slashParityFlow.draft).toBe("/water");
    expect(slashParityCases.some((row) => row.draft === "/water ")).toBe(true);
  });
});
