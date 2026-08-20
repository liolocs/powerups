import type { FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/variables";
import { runTemplate } from "#template-runners/index";
import { modificationArraySchema, type Modification } from "#schemas/modification";
import use_errors from "#errors/useErrors";

export default async function parseModifyTemplate({
  templatePath,
  variables,
}: {
  templatePath: FileRef;
  variables: ResolvedVariable;
}): Promise<Modification[]> {
  const extension = templatePath.extension;

  let json: string;

  if (extension === ".json") {
    json = await templatePath.text();
  } else {
    json = await runTemplate({ templatePath, variables });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw use_errors.modify_template_invalid_json(templatePath.name);
  }

  return modificationArraySchema.parse(parsed);
}