export default function(variables: Record<string, string>): string {
  const { commandName, description, flags, errorCases } = variables;

  const parsedFlags: Array<{
    name: string;
    long: string;
    short: string;
    description: string;
    required?: boolean;
  }> = JSON.parse(flags || "[]");

  const _parsedErrorCases: Array<{ name: string; text: string }> =
    JSON.parse(errorCases || "[]");

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

  return `import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import ${commandName}_errors from "#errors/${commandName}Errors";

const ${commandName} = new Command({
  name: "${commandName}",
  description: "${description}",
  flags: [
${flagsCode}
  ],
  subcommands: [],
  action: async ({ flags, context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();

    // TODO: implement command logic
  },
});

export default ${commandName};
`;
}