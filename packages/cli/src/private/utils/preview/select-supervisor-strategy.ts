export type SupervisorStrategy =
  | { type: "nodemon" }
  | { type: "bun-watch" }
  | { type: "denon" }
  | { type: "run-once" };

export default function selectSupervisorStrategy({
  runtimeName,
  runCommand,
}: {
  runtimeName: string;
  runCommand: string;
}): SupervisorStrategy {
  const firstToken = runCommand.trim().split(/\s+/)[0] ?? "";

  if (runtimeName === "bun" && (firstToken === "bun" || firstToken === "bunx")) {
    return { type: "bun-watch" };
  }

  if (runtimeName === "deno" && firstToken === "deno") {
    return { type: "denon" };
  }

  // node runtime, or a bun/deno runtime driving a node-based command:
  // nodemon is the universal fallback (node ships with every JS dev server).
  return { type: "nodemon" };
}
