function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(name: string): string {
  const camel = toCamelCase(name);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export default function(variables: Record<string, string>): string {
  const { commandName, description, subcommandName } = variables;
  const varName = toCamelCase(commandName);
  const subVar = varName + toPascalCase(subcommandName);

  return `import { Command } from "@pwrp/program";
import ${subVar} from "#commands/${commandName}/${subcommandName}";

const ${varName} = new Command({
  name: "${commandName}",

  description: "${description}",

  flags: [],

  subcommands: [${subVar}],

  requiresSubcommand: true,

  action: async () => {
    // This action is never called because requiresSubcommand is true
  },
});

export default ${varName};
`;
}