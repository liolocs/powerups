import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { capitalize } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

export default function createOutputValidateErrors(domain: string) {
  return error.coded({
    no_outputs_found: () => {
      const errorText = `No ${domain}s found to validate.`;
      return t`${errorBGText}${errorText}`;
    },
    not_found: (name: string) => {
      const nameText = cli.bg.yellow(" " + name + " ");
      const errorText = `${capitalize(domain)} ${nameText} not found.`;
      return t`${errorBGText}${errorText}`;
    },
    invalid: (name: string, message: string) => {
      const nameText = cli.bg.yellow(" " + name + " ");
      const errorText = `${capitalize(domain)} ${nameText} is invalid: ${message}`;
      return t`${errorBGText}${errorText}`;
    },
    validation_failed: (count: number) => {
      const countText = cli.bg.yellow(" " + String(count) + " ");
      const errorText = `Validation failed for ${countText} ${domain}(s).`;
      return t`${errorBGText}${errorText}`;
    },
  });
}