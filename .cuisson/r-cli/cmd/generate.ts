// cmd/generate.ts — Stub: generate recipe from detected cluster
// TODO: Full implementation (see Task 10 in plan)

import type { CommandDef } from "../lib/cli/types.js";

function generateAction(_args: string[], _flags: Record<string, unknown>): void {
  console.log("generate recipe");
}

export default {
  name: "generate",
  description: "Generate a recipe from detected cluster (stub)",
  action: generateAction,
} satisfies CommandDef;
