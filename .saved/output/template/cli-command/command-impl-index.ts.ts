export default ({ name, description, sub }: Record<string, string>) => {
  const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const hasSub = Boolean(sub);
  const subCamel = hasSub ? sub.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : "";
  const subImport = hasSub
    ? `import ${subCamel} from "#commands/${name}/${sub}";\n`
    : "";
  return `import { Command } from "@saved/program";
${subImport}import { CLI_NAME } from "#constants";

const ${camel} = new Command({
  name: "${name}",
  description: \`${description}\`,
  flags: [],
  subcommands: [${hasSub ? subCamel : ""}],
  requiresSubcommand: ${hasSub},
  action: () => {},
});

export default ${camel};
`;
};