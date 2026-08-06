import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { executeSteps, type RunRecord } from "#utils/execute-steps";
import type { Instructions } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-engine-tmp");

async function setup(): Promise<{ projectRoot: import("@rcompat/fs").FileRef; dist: import("@rcompat/fs").FileRef }> {
  const dir = tmpBase.append(`/${Date.now()}`);
  await fs.create(dir);
  const projectRoot = dir.append("/project");
  const dist = dir.append("/dist");
  await fs.create(projectRoot);
  await fs.create(dist.append("/templates").path);
  await dist.append("/templates/a.ts").write("export default () => 'hello';");
  return { projectRoot, dist };
}

function emptyRecord(): RunRecord {
  return { steps: [], files: [], totalCharacters: 0 };
}

test.case("create step writes a file and records it", async assert => {
  const { projectRoot, dist } = await setup();
  const record = emptyRecord();
  await executeSteps({
    steps: [{ type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{name}}.ts" }],
    variables: { name: "foo" },
    outputFolder: dist, rootDir: projectRoot,
    isDryRun: false, isOverwrite: false, record,
  });
  assert(await fs.exists(projectRoot.append("/src/foo.ts"))).true();
  assert(record.files[0].action).equals("create");
  assert(record.totalCharacters).equals("hello".length);
  await projectRoot.up(1).remove({ recursive: true });
});

test.case("variableMap resolves child names to parent values", async assert => {
  const { projectRoot, dist } = await setup();
  const record = emptyRecord();
  await executeSteps({
    steps: [{
      type: "create", name: "a", template: "templates/a.ts",
      outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{name}}" },
    }],
    variables: { name: "foo" },
    outputFolder: dist, rootDir: projectRoot,
    isDryRun: false, isOverwrite: false, record,
  });
  assert(await fs.exists(projectRoot.append("/src/foo.ts"))).true();
  await projectRoot.up(1).remove({ recursive: true });
});

test.case("dry-run prints and writes nothing", async assert => {
  const { projectRoot, dist } = await setup();
  const record = emptyRecord();
  await executeSteps({
    steps: [{ type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{name}}.ts" }],
    variables: { name: "foo" },
    outputFolder: dist, rootDir: projectRoot,
    isDryRun: true, isOverwrite: false, record,
  });
  assert(await fs.exists(projectRoot.append("/src/foo.ts"))).false();
  assert(record.totalCharacters).equals("hello".length);
  await projectRoot.up(1).remove({ recursive: true });
});

test.case("delete step records delete action", async assert => {
  const { projectRoot, dist } = await setup();
  await projectRoot.append("/src").directory.create();
  await projectRoot.append("/src/old.ts").write("x");
  const record = emptyRecord();
  await executeSteps({
    steps: [{ type: "delete", name: "d", outputPath: "src/{{name}}.ts" }],
    variables: { name: "old" },
    outputFolder: dist, rootDir: projectRoot,
    isDryRun: false, isOverwrite: false, record,
  });
  assert(record.files[0].action).equals("delete");
  assert(await fs.exists(projectRoot.append("/src/old.ts"))).false();
  await projectRoot.up(1).remove({ recursive: true });
});