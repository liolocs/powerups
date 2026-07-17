export default ({ name }: Record<string, string>) => {
  const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const pascal = name
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return `import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import ${camel} from "#commands/${name}/index";
import { CodeError } from "@rcompat/error";
import { ${pascal}ErrorCode } from "#errors/${name}Errors";
import { MAIN_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(\`/\${MAIN_FOLDER}\`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

test.case("${name} does something", async assert => {
  await reset();
  // TODO: implement test for ${name}
  await testRoot.remove();
});
`;
};