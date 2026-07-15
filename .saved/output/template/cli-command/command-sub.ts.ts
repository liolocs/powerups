export default ({ name, sub, subDescription }: Record<string, string>) => {
  if (!sub) {
    return "";
  }
  const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const subCamel = sub.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const subDesc = subDescription.replaceAll("`", "\\`");
  return `import { Command } from "@saved/program";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import fs, { type FileRef } from "@rcompat/fs";
import ${camel}Errors from "#errors/${name}Errors";
import { MAIN_FOLDER } from "#constants";

const ${subCamel} = new Command({
  name: "${sub}",
  description: \`${subDesc}\`,
  flags: [],
  subcommands: [],
  action: async (props) => {
    const root: FileRef = props?.context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(\`/\${MAIN_FOLDER}\`);
    if (!(await fs.exists(mainFolder))) {
      throw ${camel}Errors.not_found();
    }
    // TODO: implement ${sub}
    cli.print("${sub}\\n");
  },
});

export default ${subCamel};
`;
};