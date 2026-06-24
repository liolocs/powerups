// cmd/launch.ts — Launch a recipe by name (stub)
// Full implementation will be added in Task 9

import type { CommandDef } from "../lib/cli.js";

async function launchAction(args: string[], _flags: Record<string, unknown>): Promise<void> {
  const recipeName = args[0];
  if (!recipeName) {
    console.log("[x] Missing required argument: recipe name");
    return;
  }

  console.log(`Launching recipe: ${recipeName} (stub — full implementation in Task 9)`);
}

export default {
  name: "launch",
  description: "Launch a recipe by name",
  flags: [
    { short: "-v", long: "--var", value: false, array: true },
  ],
  action: launchAction,
} satisfies CommandDef;
