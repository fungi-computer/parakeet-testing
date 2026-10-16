import type {
  SessionActivity,
  SessionExtensionSlots,
} from "@fungi.computer/shiitake/client";
import {
  parseExtensionJson,
  type Json,
} from "@fungi.computer/shiitake/extensions";
import type { WhistleCatalogV1 } from "@fungi.computer/whistle/catalog";
import { z } from "zod";

/** Activity facts for a Session with nothing queued or running. */
export const idleActivity: SessionActivity = {
  queue: { state: "idle" },
  cancellationRequested: false,
  retry: null,
  activeTool: null,
  lastModelChoiceSequence: null,
  compaction: null,
};

/** Activity facts for accepted Session work awaiting its host. */
export function queuedActivity(commandId: string): SessionActivity {
  return {
    ...idleActivity,
    queue: { state: "queued", commandId, runningWork: null },
  };
}

/** Activity facts for a Session whose work is running; override what differs. */
export function runningActivity(
  overrides: Partial<SessionActivity> = {},
): SessionActivity {
  return {
    ...idleActivity,
    queue: { state: "running", commandId: "running-command" },
    ...overrides,
  };
}

/** Activity facts for a Session with a compaction running now. */
export function compactingActivity(
  trigger: NonNullable<SessionActivity["compaction"]>["trigger"] = "manual",
): SessionActivity {
  return runningActivity({ compaction: { trigger } });
}

/**
 * A test-only extension that no client names: it advertises `/water` through
 * its Session slot and answers through the ordinary extension door. Every
 * Parakeet renderer proves it can offer and run it with no client change.
 */
export const gardenExtensionId = "test-garden";

/** The catalog the garden extension advertises. */
export const gardenCatalog: WhistleCatalogV1 = {
  protocol: "whistle.catalog/v1",
  commands: [
    {
      id: "water",
      title: "Water a garden bed",
      category: "Conversation",
      description: "Water one bed, or every bed at once",
      projections: {
        help: { order: 20 },
        slash: {
          aliases: ["water"],
          order: 20,
          arguments: {
            hint: "<bed> | all",
            words: [
              {
                word: "all",
                description: "Water every bed",
                arguments: { bed: "all" },
              },
            ],
            text: { field: "bed", arguments: {} },
          },
        },
      },
    },
  ],
};

/** The slots a Session that rosters the garden extension reports. */
export function gardenSlots(): SessionExtensionSlots {
  return {
    [gardenExtensionId]: {
      status: "running",
      revision: "sha256:garden",
      value: null,
      catalog: parseExtensionJson(JSON.stringify(gardenCatalog)),
    },
  };
}

const waterInput = z.strictObject({ bed: z.string().min(1).optional() });

/** The garden extension's door: one stateless step per call. */
export function gardenCall(command: string, input: Json): Promise<Json> {
  if (command !== "water")
    return Promise.reject(new Error(`Unknown garden command ${command}`));
  const { bed } = waterInput.parse(input);
  if (bed === undefined)
    return Promise.resolve({
      type: "prompt",
      prompt: {
        type: "choice",
        message: "Which bed?",
        options: [
          { value: "fern", label: "Fern bed" },
          { value: "moss", label: "Moss bed" },
        ],
      },
      next: { arguments: {}, answer: "bed" },
    });
  return Promise.resolve({
    type: "done",
    notice: {
      type: "success",
      message: bed === "all" ? "Watered every bed." : `Watered the ${bed} bed.`,
    },
  });
}

/** One input every renderer must complete identically. */
export type SlashParityCase = Readonly<{
  /** The composer draft. */
  draft: string;
  /** The row labels every renderer must show, in order. */
  rows: readonly string[];
}>;

/**
 * Completion cases for a runtime holding only Parakeet's built-ins and the
 * garden extension. Renderers type each draft and compare the rows they draw.
 */
export const slashParityCases: readonly SlashParityCase[] = [
  { draft: "/", rows: ["/help", "/water"] },
  { draft: "/w", rows: ["/water"] },
  { draft: "/wtr", rows: ["/water"] },
  { draft: "/e", rows: ["/water"] },
  { draft: "/he", rows: ["/help"] },
  { draft: "/se", rows: [] },
  { draft: "/water ", rows: ["all"] },
  { draft: "/water a", rows: ["all"] },
  { draft: "/water fern", rows: [] },
  { draft: "/zzz", rows: [] },
];

/** The flow every renderer runs: `/water`, choose the fern bed, see the result. */
export const slashParityFlow = {
  draft: "/water",
  prompt: "Which bed?",
  choose: "Fern bed",
  notice: "Watered the fern bed.",
} as const;
