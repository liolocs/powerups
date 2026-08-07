import test from "@rcompat/test";
import fs from "@rcompat/fs";
import { logRun, readMetrics, readAllMetrics, type MetricsEntry, type ProjectMetricsEntry } from "#utils/metrics";
import { METRICS_FILE_NAME } from "#constants";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import path from "node:path";

const tempGlobalRoot = path.join(tmpdir(), `powerups-test-${randomUUID()}`);
const tempGlobalRootRef = fs.ref(tempGlobalRoot);
const fakeCwd = "/fake/project";

async function reset() {
  await tempGlobalRootRef.remove();
  await tempGlobalRootRef.create();
}

test.case("should create a metrics file and append entries on logRun", async assert => {
  await reset();

  await logRun({ output: "ui-component", characters: 500 }, { cwd: fakeCwd, globalRoot: tempGlobalRoot });
  await logRun({ output: "api-route", characters: 1200 }, { cwd: fakeCwd, globalRoot: tempGlobalRoot });

  const entries = await readMetrics({ cwd: fakeCwd, globalRoot: tempGlobalRoot });
  assert(entries.length).equals(2);

  const first = JSON.parse(JSON.stringify(entries[0])) as MetricsEntry;
  assert(first.output).equals("ui-component");
  assert(first.characters).equals(500);
  assert(typeof first.timestamp).equals("string");

  const second = JSON.parse(JSON.stringify(entries[1])) as MetricsEntry;
  assert(second.output).equals("api-route");
  assert(second.characters).equals(1200);

  await tempGlobalRootRef.remove();
});

test.case("should return parsed entries on readMetrics", async assert => {
  await reset();

  await logRun({ output: "ui-component", characters: 500 }, { cwd: fakeCwd, globalRoot: tempGlobalRoot });
  await logRun({ output: "ui-component", characters: 300 }, { cwd: fakeCwd, globalRoot: tempGlobalRoot });
  await logRun({ output: "api-route", characters: 1200 }, { cwd: fakeCwd, globalRoot: tempGlobalRoot });

  const entries = await readMetrics({ cwd: fakeCwd, globalRoot: tempGlobalRoot });
  assert(entries.length).equals(3);
  assert(entries[0].output).equals("ui-component");
  assert(entries[0].characters).equals(500);
  assert(entries[1].output).equals("ui-component");
  assert(entries[1].characters).equals(300);
  assert(entries[2].output).equals("api-route");
  assert(entries[2].characters).equals(1200);

  await tempGlobalRootRef.remove();
});

test.case("should return an empty array when the file is missing", async assert => {
  await reset();

  const entries = await readMetrics({ cwd: fakeCwd, globalRoot: tempGlobalRoot });
  assert(entries.length).equals(0);
  assert(Array.isArray(entries)).true();

  await tempGlobalRootRef.remove();
});

test.case("should skip blank and corrupt lines on readMetrics", async assert => {
  await reset();

  // Manually write a file with blank lines and corrupt JSON
  const { encodeProjectPath } = await import("#utils/project-path");
  const projectDir = path.join(tempGlobalRoot, "projects", encodeProjectPath(fakeCwd));
  const metricsPath = path.join(projectDir, METRICS_FILE_NAME);
  await fs.ref(projectDir).create();
  await fs.write(metricsPath,
    '{"timestamp":"2025-01-01T00:00:00.000Z","output":"good","characters":100}\n' +
    "\n" +
    "{not valid json}\n" +
    '{"timestamp":"2025-01-02T00:00:00.000Z","output":"also-good","characters":200}\n',
  );

  const entries = await readMetrics({ cwd: fakeCwd, globalRoot: tempGlobalRoot });
  assert(entries.length).equals(2);
  assert(entries[0].output).equals("good");
  assert(entries[1].output).equals("also-good");

  await tempGlobalRootRef.remove();
});

test.case("should append to an existing file without overwriting on logRun", async assert => {
  await reset();

  await logRun({ output: "first", characters: 10 }, { cwd: fakeCwd, globalRoot: tempGlobalRoot });
  await logRun({ output: "second", characters: 20 }, { cwd: fakeCwd, globalRoot: tempGlobalRoot });

  const entries = await readMetrics({ cwd: fakeCwd, globalRoot: tempGlobalRoot });
  assert(entries.length).equals(2);
  assert(entries[0].output).equals("first");
  assert(entries[1].output).equals("second");

  await tempGlobalRootRef.remove();
});

test.case("readAllMetrics returns entries from multiple projects tagged with project", async assert => {
  await reset();

  await logRun({ output: "ui-component", characters: 500 }, { cwd: "/fake/projecta", globalRoot: tempGlobalRoot });
  await logRun({ output: "api-route", characters: 1200 }, { cwd: "/fake/projectb", globalRoot: tempGlobalRoot });

  const entries = await readAllMetrics({ globalRoot: tempGlobalRoot });
  assert(entries.length).equals(2);

  const projectAEntries = entries.filter(e => e.project === "fake/projecta");
  assert(projectAEntries.length).equals(1);
  assert(projectAEntries[0].output).equals("ui-component");

  const projectBEntries = entries.filter(e => e.project === "fake/projectb");
  assert(projectBEntries.length).equals(1);
  assert(projectBEntries[0].output).equals("api-route");

  await tempGlobalRootRef.remove();
});

test.case("readAllMetrics returns empty array when projects dir missing", async assert => {
  await reset();

  const entries = await readAllMetrics({ globalRoot: tempGlobalRoot });
  assert(entries.length).equals(0);
  assert(Array.isArray(entries)).true();

  await tempGlobalRootRef.remove();
});