import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import generateReadableTemplate from "#utils/template-conversion/generate-readable-template";
import { runTemplate } from "#template-runners/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/readable-template");

test.case("escapes backticks, dollar-brace, and backslashes while keeping content readable", async assert => {
  const content = "line one\nwith `backtick` and ${interpolation} and \\backslash\\\n";
  const generated = generateReadableTemplate({ content });

  assert(generated).includes("`line one");
  assert(generated).includes("\\`backtick\\`");
  assert(generated).includes("\\${interpolation}");
  assert(generated).includes("\\\\backslash\\\\");
});

test.case("round-trips: generated template renders byte-identical content", async assert => {
  await fs.create(testRoot);
  const content = [
    "{",
    "  \"name\": \"hello\",",
    "  \"scripts\": { \"dev\": \"vite`weird\" }",
    "}",
    "",
  ].join("\n");

  const generated = generateReadableTemplate({ content });
  const templateRef = testRoot.append("/round-trip.ts");
  await templateRef.write(generated);

  const rendered = await runTemplate({ templatePath: templateRef, variables: {} });
  assert(rendered).equals(content);

  await testRoot.remove({ recursive: true });
});