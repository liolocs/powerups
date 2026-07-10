import string from "@rcompat/string"
import is from "@rcompat/is";

export default ({ name, description, sub }: Record<string, string>) => {
  const camel = string.toCamelCase(name);
  let subCamel = sub;
  const hasSub = is.truthy(sub);

  if (hasSub) {
    subCamel = string.toCamelCase(sub);
  }

  const desc = description.replaceAll("`", "\\`");

  return `import { Command } from "@saved/program";
${hasSub ? `import ${subCamel} from "#commands/${name}/${sub}";` : ""}
import { CLI_NAME } from "#constants";

const ${camel} = new Command({
  name: "${name}",
  description: \`${desc}\`,
  flags: [],
  subcommands: [${ hasSub ? `"${sub}"` : ""}],
  requiresSubcommand: ${hasSub},
  action: () => {},
});

export default ${camel};
`;
};