function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(name: string): string {
  const camel = toCamelCase(name);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export default function(variables: Record<string, string>): string {
  const { commandName, description, errorCases } = variables;
  const varName = toCamelCase(commandName);
  const pascalName = toPascalCase(commandName);

  const parsedErrorCases: Array<{ name: string; text: string }> =
    JSON.parse(errorCases || "[]");

  // Generate error test stubs
  let errorTests = "";
  if (parsedErrorCases.length > 0) {
    errorTests = `\ntest.group("${commandName} errors", () => {`;
    for (const e of parsedErrorCases) {
      errorTests += `
  test.case("should throw ${e.name}", async assert => {
    // TODO: set up test conditions that trigger this error
    let threw;

    try {
      await ${varName}.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();

      threw = (e as CodeError).code;
    }

    assert(threw).equals(${pascalName}ErrorCode.${e.name});
  });`;
    }
    errorTests += `\n});\n`;
  }

  return `import test from "@rcompat/test";
import ${varName} from "#commands/${commandName}/index";
import { ${pascalName}ErrorCode } from "#errors/${commandName}Errors";
import { CodeError } from "@rcompat/error";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

test.case("${commandName} has correct name and description", async assert => {
  assert(${varName}.name).equals("${commandName}");
  assert(${varName}.description).equals("${description}");
});

${errorTests}`;
}