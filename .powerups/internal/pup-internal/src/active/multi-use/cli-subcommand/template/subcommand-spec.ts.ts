function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(name: string): string {
  const camel = toCamelCase(name);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export default function(variables: Record<string, string>): string {
  const { parentCommand, subcommandName, description, errorCases } = variables;
  const parentVar = toCamelCase(parentCommand);
  const subVar = parentVar + toPascalCase(subcommandName);
  const parentPascal = toPascalCase(parentCommand);

  const parsedErrorCases: Array<{ name: string; text: string }> =
    JSON.parse(errorCases || "[]");

  // Generate error test stubs
  let errorTests = "";
  if (parsedErrorCases.length > 0) {
    errorTests = `\ntest.group("${subcommandName} errors", () => {`;
    for (const e of parsedErrorCases) {
      errorTests += `
  test.case("should throw ${e.name}", async assert => {
    // TODO: set up test conditions that trigger this error
    let threw;

    try {
      await ${subVar}.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();

      threw = (e as CodeError).code;
    }

    assert(threw).equals(${parentPascal}ErrorCode.${e.name});
  });`;
    }
    errorTests += `\n});\n`;
  }

  return `import test from "@rcompat/test";
import ${subVar} from "#commands/${parentCommand}/${subcommandName}";
import { ${parentPascal}ErrorCode } from "#errors/${parentCommand}Errors";
import { CodeError } from "@rcompat/error";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

test.case("${subcommandName} has correct name and description", async assert => {
  assert(${subVar}.name).equals("${subcommandName}");
  assert(${subVar}.description).equals("${description}");
});

${errorTests}`;
}