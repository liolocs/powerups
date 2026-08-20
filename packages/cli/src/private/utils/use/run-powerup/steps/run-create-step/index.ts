import type { CreateManifestEntry, CreateStep } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/variables";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import resolveOutputPath from "#utils/use/run-powerup/steps/shared/resolve-output-path";
import renderTemplate from "#utils/use/run-powerup/steps/run-create-step/render-template";

export default async function runCreateStep({
  step,
  isDryRun,
  destination,
  powerupDirectory,
  variables,
}: {
  step: CreateStep;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}): Promise<{ manifest: Omit<CreateManifestEntry, BaseManifestProperties> }> {
  const resolvedOutputPath = resolveOutputPath({
    outputPath: step.outputPath,
    variables,
  });

  const renderedContent = await renderTemplate({
    template: step.template,
    powerupDirectory,
    variables,
  });

  const characterCount = renderedContent.length;

  const manifest: Omit<CreateManifestEntry, BaseManifestProperties> = {
    timestamp: new Date(),
    stepName: step.name,
    from: step.from?.name,
    stepType: "create",
    status: "applied",
    output: {
      type: "create",
      path: resolvedOutputPath,
      action: "create",
      characterCount,
    },
  };

  const targetPath = destination.append(`/${resolvedOutputPath}`);

  if (await fs.exists(targetPath)) {
    return {
      manifest: {
        ...manifest,
        status: "skipped-warning",
        output: { type: "none" },
      },
    };
  }

  if (isDryRun) {
    return { manifest };
  }

  await fs.create(targetPath.directory);
  await targetPath.write(renderedContent);

  return { manifest };
}