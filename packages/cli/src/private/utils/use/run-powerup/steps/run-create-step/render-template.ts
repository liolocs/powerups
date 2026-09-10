import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import { runTemplate } from "#template-runners/index";
import use_errors from "#errors/useErrors";

export default async function renderTemplate({
  template,
  sourceBase,
  variables,
}: {
  template: string;
  sourceBase: FileRef;
  variables: ResolvedVariable;
}): Promise<string> {
  const templatePath = sourceBase.append(`/${template}`);

  if (!(await fs.exists(templatePath))) {
    throw use_errors.template_not_found(template);
  }

  return runTemplate({ templatePath, variables });
}