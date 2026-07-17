export default ({ name, sub }: Record<string, string>) => {
  const subCamel = sub.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return JSON.stringify(
    [
      {
        where: { after: 'import { Command } from "@powers/program";' },
        content: `\nimport ${subCamel} from "#commands/${name}/${sub}";`,
      },
      {
        where: "subcommands: []",
        content: `subcommands: [${subCamel}],\n  requiresSubcommand: true,`,
      },
    ],
    null,
    2,
  );
};