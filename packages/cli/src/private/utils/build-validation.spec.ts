import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { validateInstructions } from "#utils/build-validation";
import type { Instructions } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-build-val-tmp");

function mkInstructions(steps: any[]): Instructions {
  return {
    name: "p", type: "multi-use", description: "d",
    variables: { required: ["name"], optional: [] }, intent: [], steps,
  } as Instructions;
}

test.case("passes for valid flattened instructions", async assert => {
  const dir = tmpBase.append("/ok");
  await fs.create(dir);
  await dir.append("/templates").directory.create();
  await dir.append("/templates/a.ts").write("export default () => '';");
  const issues = await validateInstructions(
    mkInstructions([
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{name}}.ts" },
      { type: "create", name: "child:b", template: "_internal/child/templates/b.ts", outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{name}}" } },
    ]),
    { outputFolder: dir },
  );
  assert(issues.length).equals(0);
  await dir.remove({ recursive: true });
});

test.case("flags duplicate step names", async assert => {
  const issues = await validateInstructions(
    mkInstructions([
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "x" },
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "y" },
    ]),
    { outputFolder: tmpBase },
  );
  assert(issues.some(i => i.includes("duplicate step name: a"))).true();
});

test.case("flags missing own template", async assert => {
  const dir = tmpBase.append("/missing");
  await fs.create(dir);
  const issues = await validateInstructions(
    mkInstructions([
      { type: "create", name: "a", template: "templates/missing.ts", outputPath: "x" },
    ]),
    { outputFolder: dir },
  );
  assert(issues.some(i => i.includes("missing template file: templates/missing.ts"))).true();
  await dir.remove({ recursive: true });
});

test.case("flags unknown variable in outputPath", async assert => {
  const issues = await validateInstructions(
    mkInstructions([
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{unknown}}.ts" },
    ]),
    { outputFolder: tmpBase },
  );
  assert(issues.some(i => i.includes("uses {{unknown}} before it is available"))).true();
});

test.case("allows variableMap keys as available within their step", async assert => {
  const dir = tmpBase.append("/varmap");
  await fs.create(dir);
  await dir.append("/templates").directory.create();
  await dir.append("/templates/a.ts").write("export default () => '';");
  const issues = await validateInstructions(
    mkInstructions([
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{name}}" } },
    ]),
    { outputFolder: dir },
  );
  assert(issues.length).equals(0);
  await dir.remove({ recursive: true });
});