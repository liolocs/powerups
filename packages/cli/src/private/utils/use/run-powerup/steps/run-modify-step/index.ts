import type { ModifyManifestEntry, ModifyStep } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/variables";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import resolveOutputPath from "#utils/use/run-powerup/steps/shared/resolve-output-path";
import parseModifyTemplate from "#utils/use/run-powerup/steps/run-modify-step/parse-modify-template";
import { applyModifications } from "#utils/use/run-powerup/steps/run-modify-step/apply-modifications";

export default async function runModifyStep({
  step,
  isDryRun,
  destination,
  powerupDirectory,
  variables,
}: {
  step: ModifyStep;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}): Promise<Omit<ModifyManifestEntry, BaseManifestProperties>> {
  const resolvedOutputPath = resolveOutputPath({
    outputPath: step.outputPath,
    variables,
  });

  const manifest: Omit<ModifyManifestEntry, BaseManifestProperties> = {
    timestamp: new Date(),
    stepName: step.name,
    from: step.from?.name,
    stepType: "modify",
    status: "applied",
    output: {
      type: "modify",
      path: resolvedOutputPath,
      action: "modify",
      characterCount: 0,
    },
  };

  const templatePath = powerupDirectory.append(`/${step.template}`);
  const targetPath = destination.append(`/${resolvedOutputPath}`);

  try {
    const modifications = await parseModifyTemplate({
      templatePath,
      variables,
    });

    const modifiedContent = await applyModifications({
      modifications,
      outputPath: resolvedOutputPath,
      targetPath,
    });

    const characterCount = modifiedContent.length;

    if (!isDryRun) {
      await fs.create(targetPath.directory);
      await targetPath.write(modifiedContent);
    }

    return {
      ...manifest,
      output: {
        type: "modify",
        path: resolvedOutputPath,
        action: "modify",
        characterCount,
      },
    };
  } catch {
    return {
      ...manifest,
      status: "skipped-warning",
      output: { type: "none" },
    };
  }
}