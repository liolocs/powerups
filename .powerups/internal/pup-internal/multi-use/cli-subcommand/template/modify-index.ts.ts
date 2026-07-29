function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(name: string): string {
  const camel = toCamelCase(name);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export default function(variables: Record<string, string>): string {
  const { parentCommand, subcommandName } = variables;
  const parentVar = toCamelCase(parentCommand);
  const subVar = parentVar + toPascalCase(subcommandName);

  const modifications = [
    // Insert import line before the Command declaration
    {
      where: { before: `const ${parentVar} = new Command({` },
      content: `import ${subVar} from "#commands/${parentCommand}/${subcommandName}";\n`,
    },
    // Add subcommand to the subcommands array
    {
      where: "subcommands: [",
      content: `subcommands: [${subVar}, `,
    },
  ];

  return JSON.stringify(modifications, null, 2);
}