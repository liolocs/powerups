function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(name: string): string {
  const camel = toCamelCase(name);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export default function(variables: Record<string, string>): string {
  const { parentCommand, subcommandName, description, flags, errorCases } = variables;
  const parentVar = toCamelCase(parentCommand);
  const subVar = parentVar + toPascalCase(subcommandName);

  const parsedFlags: Array<{
    name: string;
    long: string;
    short: string;
    description: string;
    required?: boolean;
  }> = JSON.parse(flags || "[]");

  const _parsedErrorCases: Array<{ name: string; text: string }> =
    JSON.parse(errorCases || "[]");

  const hasFlags = parsedFlags.length > 0;

  // Generate flags array
  const flagsCode = parsedFlags.map(f => {
    const lines = [
      "    {",
      `      name: "${f.name}",`,
      `      long: "${f.long}",`,
      `      short: "${f.short}",`,
      `      description: "${f.description}",`,
    ];
    if (f.required === true) {
      lines.push("      required: true,");
    }
    lines.push("    }");
    return lines.join("\n");
  }).join(",\n");

  // Subcommands always need subcommands (positional args).
  // When flags exist, props is required and we can destructure.
  // When no flags, props is optional — use props?.subcommands, props?.context.
  const actionLine = hasFlags
    ? "  action: async ({ subcommands, flags, context }) => {"
    : "  action: async (props) => {";
  const rootLine = hasFlags
    ? "    const root: FileRef = context?.root ?? await runtime.projectRoot();"
    : "    const root: FileRef = props?.context?.root ?? await runtime.projectRoot();";

  const flagsBlock = hasFlags
    ? `  flags: [\n${flagsCode}\n  ],`
    : "  flags: [],";

  return `import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import ${parentVar}_errors from "#errors/${parentCommand}Errors";

const ${subVar} = new Command({
  name: "${subcommandName}",
  description: "${description}",
${flagsBlock}
  subcommands: [],
${actionLine}
${rootLine}

    // TODO: implement subcommand logic
  },
});

export default ${subVar};
`;
}