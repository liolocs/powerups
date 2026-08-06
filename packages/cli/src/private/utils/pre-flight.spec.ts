import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { preFlight } from "#utils/pre-flight";
import type { Instructions } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-preflight-tmp");

function mkInstructions(steps: any[]): Instructions {
  return {
    name: "p", type: "multi-use", description: "d",
    variables: { required: ["name"], optional: [] }, intent: [], steps,
  } as Instructions;
}

test.case("passes when templates exist and no collisions", async assert => {
  const dir = tmpBase.append("/ok");
  await fs.create(dir);
  await dir.append("/dist/templates").directory.create();
  await dir.append("/dist/templates/a.ts").write("x");
  const projectRoot = dir.append("/project");
  await fs.create(projectRoot);
  await preFlight({
    instructions: mkInstructions([{ type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{name}}.ts" }]),
    outputFolder: dir.append("/dist"),
    rootDir: projectRoot,
    variables: { name: "foo" },
    isOverwrite: false,
  });
  assert(true).true();
  await dir.remove({ recursive: true });
});

test.case("fails on missing template", async assert => {
  const dir = tmpBase.append("/missing-tmpl");
  await fs.create(dir);
  const projectRoot = dir.append("/project");
  await fs.create(projectRoot);
  let threw = false;
  try {
    await preFlight({
      instructions: mkInstructions([{ type: "create", name: "a", template: "templates/a.ts", outputPath: "src/x.ts" }]),
      outputFolder: dir.append("/dist"),
      rootDir: projectRoot,
      variables: { name: "foo" },
      isOverwrite: false,
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
  await dir.remove({ recursive: true });
});

test.case("fails on create collision without --overwrite", async assert => {
  const dir = tmpBase.append("/collision");
  await fs.create(dir);
  await dir.append("/dist/templates").directory.create();
  await dir.append("/dist/templates/a.ts").write("x");
  const projectRoot = dir.append("/project");
  await fs.create(projectRoot.append("/src").path);
  await projectRoot.append("/src/foo.ts").write("exists");
  let threw = false;
  try {
    await preFlight({
      instructions: mkInstructions([{ type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{name}}.ts" }]),
      outputFolder: dir.append("/dist"),
      rootDir: projectRoot,
      variables: { name: "foo" },
      isOverwrite: false,
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
  await dir.remove({ recursive: true });
});

test.case("defers collision check for read-produced variables", async assert => {
  const dir = tmpBase.append("/defer");
  await fs.create(dir);
  await dir.append("/dist/templates").directory.create();
  await dir.append("/dist/templates/a.ts").write("x");
  const projectRoot = dir.append("/project");
  await fs.create(projectRoot);
  await preFlight({
    instructions: mkInstructions([
      { type: "read", name: "r", path: "src/x.txt", as: "readVar" },
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{readVar}}.ts" },
    ]),
    outputFolder: dir.append("/dist"),
    rootDir: projectRoot,
    variables: { name: "foo" },
    isOverwrite: false,
  });
  assert(true).true();
  await dir.remove({ recursive: true });
});