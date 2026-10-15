# Parakeet Testing (`@fungi.computer/parakeet-testing`)

Parakeet Testing provides shared fixtures for tests of Parakeet renderers. The
fixtures model Shiitake Session activity and one extension catalog so each
renderer can exercise the same extension and slash-completion cases.

## Install or set up

This package provides shared test fixtures, not a runtime dependency of shipped
renderers. From the repository root, build it with:

```sh
pnpm turbo:run run build --filter=@fungi.computer/parakeet-testing
```

Import fixtures from `@fungi.computer/parakeet-testing` in workspace test code.

## Quick start

This illustrative example gives a Session a running test extension slot and
checks the fixture's response to a command:

```ts
import {
  gardenCall,
  gardenExtensionId,
  gardenSlots,
} from "@fungi.computer/parakeet-testing";

const slots = gardenSlots();
const extension = slots[gardenExtensionId];
if (extension?.status !== "running") throw new Error("Fixture is not running");

const reply = await gardenCall("water", { bed: "fern" });
```

The fixture test verifies slot construction and the garden reply in
[`test/garden.test.ts`](test/garden.test.ts). Renderer tests should exercise
their own Session and UI seams with these shared inputs.

## Core concepts

`idleActivity`, `queuedActivity`, and `runningActivity` create common Session
activity states. `gardenExtensionId`, `gardenCatalog`, and `gardenSlots()`
provide a running `test-garden` extension advertising `/water`. Its `gardenCall`
function answers that command with a choice prompt when no bed is given and a
success result when one is provided.

`slashParityCases` lists composer drafts and the completion rows every renderer
should show for built-in commands plus `/water`. `slashParityFlow` describes the
shared flow: enter `/water`, choose the fern bed, and receive the success
notice.

## API reference

See the generated [fixture API reference](docs/api/README.md) for exported
fixtures and types.

## Examples and checks

Run the fixture contract tests with:

```sh
pnpm --filter @fungi.computer/parakeet-testing test
```

Consumer tests live with their renderer. This package's test verifies its
fixtures; it does not prove every renderer uses them correctly.

## Limits and errors

These fixtures model a small extension and a fixed completion flow. They do not
provide production Session state, execute real tools, or replace tests of a
renderer's own input, completion, and dispatch behavior. The package is not
packed for publication.

## Contribute and license

Keep shared cases deterministic and suitable for renderer tests. The package
declares an MIT license.
