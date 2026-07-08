import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

export default function createOutputSearchErrors(domain: string) {
  return error.coded({
    no_matching: () => {
      const errorText = `No matching ${domain}s found.`;
      return t`${errorBGText}${errorText}`;
    },
  });
}