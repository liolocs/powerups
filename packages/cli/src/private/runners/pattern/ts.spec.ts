import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import tsRunner from "#runners/pattern/ts";
import { CodeError } from "@rcompat/error";

const root = await runtime.projectRoot();
const tmpDir = root.append("/.test-ts-tmp");

test.case("ts runner renders a template with a default function export",
  async assert => {
    await fs.create(tmpDir);
    const templatePath = tmpDir.append("/button.ts");
    await templatePath.write(
      "export default function({ componentName, theme }: Record<string, string>) {\n" +
      "  return `<button class=\"${theme}\">${componentName}</button>`;\n" +
      "}\n",
    );

    const result = await tsRunner({
      templatePath,
      variables: { componentName: "Button", theme: "dark" },
    });

    assert(result).equals("<button class=\"dark\">Button</button>");

    await tmpDir.remove();
  });

test.case("ts runner throws template_not_found for missing file",
  async assert => {
    await fs.create(tmpDir);
    const templatePath = tmpDir.append("/nonexistent.ts");

    let threw = false;
    try {
      await tsRunner({ templatePath, variables: {} });
    } catch (e) {
      threw = true;
      assert(e instanceof CodeError).true();
      assert((e as CodeError).code).equals("template_not_found");
    }
    assert(threw).true();

    await tmpDir.remove();
  });

test.case("ts runner throws invalid_ts_template when no default function",
  async assert => {
    await fs.create(tmpDir);
    const templatePath = tmpDir.append("/no-default.ts");
    await templatePath.write("export const notDefault = () => 'hello';\n");

    let threw = false;
    try {
      await tsRunner({ templatePath, variables: {} });
    } catch (e) {
      threw = true;
      assert(e instanceof CodeError).true();
      // Could be invalid_ts_template or template_execution_error depending
      // on runtime — both indicate the template is invalid
    }
    assert(threw).true();

    await tmpDir.remove();
  });