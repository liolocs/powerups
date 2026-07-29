function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(name: string): string {
  const camel = toCamelCase(name);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export default function(variables: Record<string, string>): string {
  const { commandName, errorCases } = variables;
  const varName = toCamelCase(commandName);
  const pascalName = toPascalCase(commandName);

  const parsedErrorCases: Array<{ name: string; text: string }> =
    JSON.parse(errorCases || "[]");

  // Generate error cases
  let errorCasesCode: string;
  if (parsedErrorCases.length === 0) {
    errorCasesCode = "  // TODO: add error cases";
  } else {
    errorCasesCode = parsedErrorCases.map(e => {
      const escapedText = e.text
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n");
      return `  ${e.name}: () => {
    const errorText = "${escapedText}";
    return t\`\${errorBGText}\${errorText}\`;
  },`;
    }).join("\n");
  }

  return `import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const ${varName}_errors = error.coded({
${errorCasesCode}
});

export type ${pascalName}ErrorCode = keyof typeof ${varName}_errors;

export const ${pascalName}ErrorCode = Object.fromEntries(
  Object.keys(${varName}_errors).map(k => [k, k]),
) as { [K in ${pascalName}ErrorCode]: K };

export default ${varName}_errors;
`;
}