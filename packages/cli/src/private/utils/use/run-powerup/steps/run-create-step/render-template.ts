import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/variables";
import { runTemplate } from "#template-runners/index";
import use_errors from "#errors/useErrors";

export default async function renderTemplate({
  template,
  powerupDirectory,
  variables,
}: {
  template: string;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}): Promise<string> {
  const templatePath = powerupDirectory.append(`/${template}`);

  if (!(await fs.exists(templatePath))) {
    throw use_errors.template_not_found(template);
  }

  return runTemplate({ templatePath, variables });
}