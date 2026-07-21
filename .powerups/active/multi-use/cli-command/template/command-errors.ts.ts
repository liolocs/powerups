export default ({ name }: Record<string, string>) => {
  const snake = name.replace(/-/g, "_");
  const pascal = name
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return `import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const ${snake}_errors = error.coded({
  not_found: () => {
    const errorText = \`.powerups folder not found. Run "\${CLI_NAME} init" first.\`;
    return t\`\${errorBGText}\${errorText}\`;
  },
});

export type ${pascal}ErrorCode = keyof typeof ${snake}_errors;

export const ${pascal}ErrorCode = Object.fromEntries(
  Object.keys(${snake}_errors).map((k) => [k, k]),
) as { [K in ${pascal}ErrorCode]: K };

export default ${snake}_errors;
`;
};