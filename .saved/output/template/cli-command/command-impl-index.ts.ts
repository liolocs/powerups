export default ({ name, description, sub }: Record<string, string>) => {
  const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const subCamel = sub.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const desc = description.replaceAll("`", "\\`");
  return `import { Command } from "@saved/program";
import ${subCamel} from "#commands/${name}/${sub}";
import { CLI_NAME } from "#constants";

const ${camel} = new Command({
  name: "${name}",
  description: \`${desc}\`,
  flags: [],
  subcommands: [${subCamel}],
  requiresSubcommand: true,
  action: () => {},
});

export default ${camel};
`;
};