import type { ReadManifestEntry, ReadStep } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/variables";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import applyVariablesToTemplateString from "#utils/use/apply-variables-to-template-string";
import renderTemplate from "#utils/use/run-powerup/steps/run-create-step/render-template";
import navigateJsonPath from "#utils/use/run-powerup/steps/run-read-step/navigate-json-path";
import use_errors from "#errors/useErrors";

export default async function runReadStep({
  step,
  isDryRun,
  destination,
  powerupDirectory,
  variables,
}: {
  step: ReadStep;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}): Promise<{
  manifest: Omit<ReadManifestEntry, BaseManifestProperties>;
  variableUpdate: { name: string; value: string };
}> {
  const resolvedPath = applyVariablesToTemplateString({
    templateString: step.path,
    variables,
  });

  const manifest: Omit<ReadManifestEntry, BaseManifestProperties> = {
    timestamp: new Date(),
    stepName: step.name,
    from: step.from?.name,
    stepType: "read",
    status: "applied",
    output: { type: "read", variable: step.as },
  };

  const targetPath = destination.append(`/${resolvedPath}`);

  if (!(await fs.exists(targetPath))) {
    throw use_errors.read_file_not_found(resolvedPath);
  }

  const content = await targetPath.text();

  let value: string;

  if (step.template) {
    value = await renderTemplate({
      template: step.template,
      powerupDirectory,
      variables: { ...variables, __content: content },
    });
  } else if (step.jsonPath) {
    let json: unknown;

    try {
      json = JSON.parse(content);
    } catch {
      throw use_errors.read_json_parse_error(resolvedPath);
    }

    try {
      value = navigateJsonPath({ json, path: step.jsonPath });
    } catch {
      throw use_errors.read_json_path_not_found(resolvedPath, step.jsonPath);
    }
  } else {
    value = content;
  }

  return {
    manifest,
    variableUpdate: { name: step.as, value },
  };
}