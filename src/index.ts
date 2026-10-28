import type {
  SessionActivity,
  SessionExtensionSlots,
} from "@fungi.computer/shiitake/client";
import {
  parseExtensionJson,
  type Json,
} from "@fungi.computer/shiitake/extensions";
import type { WhistlePrompt } from "@fungi.computer/whistle";
import type { WhistleCatalogV1 } from "@fungi.computer/whistle/catalog";
import { parsePrompt } from "@fungi.computer/whistle/wire";
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

/** The state of one decision a fixture holds, shaped like the Parakeet reducer's. */
export type AwaitingFixtureState = Readonly<{
  highlight: number;
  toggled: ReadonlySet<string>;
  other: string;
  phase: "choose" | "other" | "confirm" | "sending" | "refused";
  refusal?: string;
  details: boolean;
}>;

/** One decision shown at one moment, held identically by every renderer's test. */
export type AwaitingFixture = Readonly<{
  /** What the fixture shows, for test names. */
  name: string;
  kind: "question" | "approval";
  prompt: Extract<WhistlePrompt, { type: "decision" }>;
  state: AwaitingFixtureState;
  /** One-based place among all waiting decisions. */
  position: number;
  /** Every waiting decision. */
  total: number;
}>;

function decision(
  input: Omit<Extract<WhistlePrompt, { type: "decision" }>, "type">,
): Extract<WhistlePrompt, { type: "decision" }> {
  const prompt = parsePrompt({ type: "decision", ...input });
  if (prompt.type !== "decision") throw new Error("Expected a decision prompt");
  return prompt;
}

const storage = decision({
  message: "Which store should hold the notes?",
  options: [
    {
      value: "SQLite",
      label: "SQLite",
      description: "Keep notes on this computer.",
    },
    {
      value: "PostgreSQL",
      label: "PostgreSQL",
      description: "Use the shared database.",
    },
  ],
  other: {
    label: "Other…",
    placeholder: "Write your own answer",
    maxLength: 4_000,
  },
});

const deliverables = decision({
  message: "Which deliverables should ship?",
  summary: "Question 1 of 2",
  options: [
    { value: "Docs", label: "Docs", description: "Explain usage." },
    { value: "Tests", label: "Tests", description: "Verify behavior." },
    { value: "Examples", label: "Examples", description: "Show it working." },
  ],
  multiple: true,
  other: {
    label: "Other…",
    placeholder: "Write your own answer",
    maxLength: 4_000,
  },
});

const approval = decision({
  message: "Allow `git add hello.js`?",
  summary: "Research Agent wants to run this outside the sandbox, as you.",
  facts: [
    { label: "Folder", value: "~/src/garden" },
    { label: "Why", value: "“Git metadata is read-only”" },
  ],
  options: [
    { value: "approve", label: "Approve once" },
    { value: "always", label: "Always allow “git add” in this project…" },
    { value: "deny", label: "Deny" },
  ],
  other: {
    label: "Deny and say why…",
    placeholder: "A short reason for the Agent (optional)",
    maxLength: 512,
    blank: "deny",
  },
});

const confirmation = decision({
  message: "Always allow “git add” in this project?",
  summary:
    "Git hooks in this project can run code as you, and this Agent can add hooks.",
  body: "Any Workspace Agent here can then run `git add …` without asking.",
  options: [
    { value: "back", label: "Back" },
    { value: "always-allow", label: "Always allow “git add” and run it now" },
  ],
  escape: "back",
});

const start: AwaitingFixtureState = {
  highlight: 0,
  toggled: new Set(),
  other: "",
  phase: "choose",
  details: false,
};

/**
 * The decisions every renderer must draw the same way. Each Parakeet renderer
 * renders every fixture and holds its output to `decisionView`.
 */
export const awaitingFixtures: readonly AwaitingFixture[] = [
  {
    name: "single",
    kind: "question",
    prompt: storage,
    state: start,
    position: 1,
    total: 1,
  },
  {
    name: "multiple toggled",
    kind: "question",
    prompt: deliverables,
    state: { ...start, highlight: 2, toggled: new Set(["Docs", "Examples"]) },
    position: 1,
    total: 1,
  },
  {
    name: "other typing",
    kind: "question",
    prompt: storage,
    state: { ...start, highlight: 2, other: "MySQL", phase: "other" },
    position: 1,
    total: 1,
  },
  {
    name: "2 of 3",
    kind: "question",
    prompt: storage,
    state: { ...start, highlight: 1 },
    position: 2,
    total: 3,
  },
  {
    name: "sending",
    kind: "question",
    prompt: storage,
    state: { ...start, phase: "sending" },
    position: 1,
    total: 1,
  },
  {
    name: "refused",
    kind: "question",
    prompt: storage,
    state: {
      ...start,
      phase: "refused",
      refusal: "That question is already closed.",
    },
    position: 1,
    total: 1,
  },
  {
    name: "approval",
    kind: "approval",
    prompt: approval,
    state: start,
    position: 1,
    total: 1,
  },
  {
    name: "approval confirm",
    kind: "approval",
    prompt: confirmation,
    state: start,
    position: 1,
    total: 2,
  },
  {
    name: "approval refused",
    kind: "approval",
    prompt: approval,
    state: {
      ...start,
      phase: "refused",
      refusal: "This request changed. Look again before answering.",
    },
    position: 1,
    total: 1,
  },
];
