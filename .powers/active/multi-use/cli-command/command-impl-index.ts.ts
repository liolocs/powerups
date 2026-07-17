export default ({ name, description }: Record<string, string>) => {
  const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return `import { Command } from "@powers/program";
import { CLI_NAME } from "#constants";

const ${camel} = new Command({
  name: "${name}",
  description: \`${description}\`,
  flags: [],
  subcommands: [],
  action: () => {},
});

export default ${camel};
`;
};