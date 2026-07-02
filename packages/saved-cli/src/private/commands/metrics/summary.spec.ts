import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import summary from "#commands/metrics/summary";
import captureStdout from "#test-utils/capture-stdout";
import { CodeError } from "@rcompat/error";
import { logRun } from "#utils/metrics";
import { MAIN_FOLDER, METRICS_FILE } from "#constants";

const root = await runtime.projectRoot();
const mainFolder = root.append(`/${MAIN_FOLDER}`);
const metricsPath = root.append(`/${MAIN_FOLDER}/${METRICS_FILE}`);

async function reset() {
  if (await fs.exists(mainFolder)) {
    await mainFolder.remove();
  }
  await fs.create(mainFolder);
}

test.case("summary prints no-metrics message when file is empty", async assert => {
  await reset();

  const output = await captureStdout(() => summary.run({
    subcommands: [],
    flags: [],
  }));

  assert(output).includes("No metrics recorded yet");

  await mainFolder.remove();
});

test.case("summary prints no-metrics message when file missing", async assert => {
  await reset();

  const output = await captureStdout(() => summary.run({
    subcommands: [],
    flags: [],
  }));

  assert(output).includes("No metrics recorded yet");

  await mainFolder.remove();
});

test.case("summary prints table with aggregated data", async assert => {
  await reset();

  await logRun({ pattern: "ui-component", characters: 3000 });
  await logRun({ pattern: "ui-component", characters: 1500 });
  await logRun({ pattern: "api-route", characters: 1200 });

  const output = await captureStdout(() => summary.run({
    subcommands: [],
    flags: [],
  }));

  // Header
  assert(output).includes("Pattern");
  assert(output).includes("Runs");
  assert(output).includes("Characters");
  assert(output).includes("Est. Tokens Saved");

  // Pattern rows — ui-component first (more characters, sorted descending)
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

  await mainFolder.remove();
});

test.case("summary throws dry_folder_not_found without .saved", async assert => {
  if (await fs.exists(mainFolder)) {
    await mainFolder.remove();
  }

  let threw = false;
  try {
    await summary.run({
      subcommands: [],
      flags: [],
    });
  } catch (e) {
    threw = true;
    assert(e instanceof CodeError).true();
    assert((e as CodeError).code).equals("dry_folder_not_found");
  }
  assert(threw).true();
});