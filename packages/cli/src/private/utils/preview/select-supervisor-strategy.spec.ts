import test from "#test-utils/test/index";
import selectSupervisorStrategy from "#utils/preview/select-supervisor-strategy";

test.case("node runtime uses nodemon", async assert => {
  assert(selectSupervisorStrategy({ runtimeName: "node", runCommand: "npm run dev" }).type).equals("nodemon");
});

test.case("bun runtime with bun-driven command uses bun-watch", async assert => {
  assert(selectSupervisorStrategy({ runtimeName: "bun", runCommand: "bun run dev" }).type).equals("bun-watch");
});

test.case("bun runtime with a node-driven command falls back to nodemon", async assert => {
  assert(selectSupervisorStrategy({ runtimeName: "bun", runCommand: "npm run dev" }).type).equals("nodemon");
});

test.case("deno runtime with deno-driven command uses denon", async assert => {
  assert(selectSupervisorStrategy({ runtimeName: "deno", runCommand: "deno run server.ts" }).type).equals("denon");
});

test.case("deno runtime with a node-driven command falls back to nodemon", async assert => {
  assert(selectSupervisorStrategy({ runtimeName: "deno", runCommand: "npm run dev" }).type).equals("nodemon");
});
