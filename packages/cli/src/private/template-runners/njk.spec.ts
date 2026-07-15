import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import njkRunner from "#template-runners/njk";
import { CodeError } from "@rcompat/error";

const root = await runtime.projectRoot();
const tmpDir = root.append("/.test-njk-tmp");

test.case("should render a simple njk template", async assert => {
  await fs.create(tmpDir);
  const templatePath = tmpDir.append("/button.njk");
  await templatePath.write("<button class=\"{{ theme }}\">{{ componentName }}</button>");

  const result = await njkRunner({
    templatePath,
    variables: { componentName: "Button", theme: "dark" },
  });

  // @rcompat/fs .write() appends a trailing newline to the template file,
  // and nunjucks preserves it — trim before comparing rendered content.
  assert(result.trimEnd()).equals("<button class=\"dark\">Button</button>");

  await tmpDir.remove();
});

test.case("should throw template_not_found for a missing njk file", async assert => {
  await fs.create(tmpDir);
  const templatePath = tmpDir.append("/nonexistent.njk");

  let threw = false;
  try {
    await njkRunner({ templatePath, variables: {} });
  } catch (e) {
    threw = true;
    assert(e instanceof CodeError).true();
    assert((e as CodeError).code).equals("template_not_found");
  }
  assert(threw).true();

  await tmpDir.remove();
});

test.case("should wrap Nunjucks syntax errors as template_execution_error", async assert => {
  await fs.create(tmpDir);
  const templatePath = tmpDir.append("/bad.njk");
  await templatePath.write("{% if missing_paren %}");

  let threw = false;
  try {
    await njkRunner({ templatePath, variables: {} });
  } catch (e) {
    threw = true;
    assert(e instanceof CodeError).true();
    assert((e as CodeError).code).equals("template_execution_error");
  }
  assert(threw).true();

  await tmpDir.remove();
});