import test from "@rcompat/test";
import fs from "@rcompat/fs";
import summary from "#commands/metrics/summary";
import captureStdout from "#test-utils/capture-stdout";
import { logRun } from "#utils/metrics";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import path from "node:path";

const tempGlobalRoot = path.join(tmpdir(), `powerups-test-${randomUUID()}`);
const tempGlobalRootRef = fs.ref(tempGlobalRoot);
const fakeCwd = "/fake/summary-project";

async function reset() {
  await tempGlobalRootRef.remove();
  await tempGlobalRootRef.create();
}

test.case("summary prints no-metrics message when no metrics exist", async assert => {
  await reset();

  const output = await captureStdout(() => summary.run({
    subcommands: [],
    flags: [],
    context: { root: fs.ref(fakeCwd), globalRoot: tempGlobalRoot },
  }));

  assert(output).includes("No metrics recorded yet");

  await tempGlobalRootRef.remove();
});

test.case("summary prints table with aggregated data", async assert => {
  await reset();

  await logRun({ output: "ui-component", characters: 3000 }, { cwd: fakeCwd, globalRoot: tempGlobalRoot });
  await logRun({ output: "ui-component", characters: 1500 }, { cwd: fakeCwd, globalRoot: tempGlobalRoot });
  await logRun({ output: "api-route", characters: 1200 }, { cwd: fakeCwd, globalRoot: tempGlobalRoot });

  const output = await captureStdout(() => summary.run({
    subcommands: [],
    flags: [],
    context: { root: fs.ref(fakeCwd), globalRoot: tempGlobalRoot },
  }));

  // Header
  assert(output).includes("Output");
  assert(output).includes("Runs");
  assert(output).includes("Characters");
  assert(output).includes("Est. Tokens powerups");

  // Output rows — ui-component first (more characters, sorted descending)
  assert(output).includes("ui-component");
  assert(output).includes("api-route");

  // ui-component: 2 runs, 4500 characters, ~1125 tokens
  assert(output).includes("4,500");
  assert(output).includes("~1,125");

  // api-route: 1 run, 1200 characters, ~300 tokens
  assert(output).includes("1,200");
  assert(output).includes("~300");

  // Total row
  assert(output).includes("TOTAL");
  assert(output).includes("5,700");
  assert(output).includes("~1,425");

  await tempGlobalRootRef.remove();
});

test.case("summary -g prints grouped table with all projects", async assert => {
  await reset();

  await logRun({ output: "ui-component", characters: 3000 }, { cwd: "/fake/projecta", globalRoot: tempGlobalRoot });
  await logRun({ output: "api-route", characters: 1200 }, { cwd: "/fake/projectb", globalRoot: tempGlobalRoot });

  const output = await captureStdout(() => summary.run({
    subcommands: [],
    flags: [{ flag: "--all", value: "true" }],
    context: { root: fs.ref("/fake/projecta"), globalRoot: tempGlobalRoot },
  }));

  // Header includes Project column
  assert(output).includes("Project");
  assert(output).includes("Output");
  assert(output).includes("Runs");
  assert(output).includes("Characters");
  assert(output).includes("Est. Tokens powerups");

  // Both projects appear
  assert(output).includes("fake/projecta");
  assert(output).includes("fake/projectb");

  // Both powerups appear
  assert(output).includes("ui-component");
  assert(output).includes("api-route");

  // Total row
  assert(output).includes("TOTAL");
  assert(output).includes("4,200");

  await tempGlobalRootRef.remove();
});

test.case("summary -g prints no-metrics message when no projects exist", async assert => {
  await reset();

  const output = await captureStdout(() => summary.run({
    subcommands: [],
    flags: [{ flag: "--all", value: "true" }],
    context: { root: fs.ref(fakeCwd), globalRoot: tempGlobalRoot },
  }));

  assert(output).includes("No metrics recorded yet");

  await tempGlobalRootRef.remove();
});
