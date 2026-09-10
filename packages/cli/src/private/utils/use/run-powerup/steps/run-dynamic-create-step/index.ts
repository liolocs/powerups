import type { CreateManifestEntry, DynamicCreateStep } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import resolveOutputPath from "#utils/use/run-powerup/steps/shared/resolve-output-path";
import renderTemplate from "#utils/use/run-powerup/steps/run-create-step/render-template";
import writeIfChanged from "#utils/shared/write-if-changed";

export default async function runDynamicCreateStep({
  step,
  isDryRun,
  destination,
  sourceBase,
  variables,
  overwriteExisting,
}: {
  step: DynamicCreateStep;
  isDryRun: boolean;
  destination: FileRef;
  sourceBase: FileRef;
  variables: ResolvedVariable;
  overwriteExisting: boolean;
}): Promise<{ manifest: Omit<CreateManifestEntry, BaseManifestProperties> }> {
  const resolvedOutputPath = resolveOutputPath({ outputPath: step.outputPath, variables });

  const renderedContent = await renderTemplate({
    template: step.template,
    sourceBase,
    variables,
  });

  const manifest: Omit<CreateManifestEntry, BaseManifestProperties> = {
    timestamp: new Date(),
    stepName: step.name,
    from: step.from?.name,
    stepType: "dynamic-create",
    status: "applied",
    output: {
      type: "create",
      path: resolvedOutputPath,
      action: "create",
      characterCount: renderedContent.length,
    },
  };

  const targetPath = destination.append(`/${resolvedOutputPath}`);

  if ((await targetPath.exists()) && !overwriteExisting) {
    return { manifest: { ...manifest, status: "skipped-warning", output: { type: "none" } } };
  }

  if (isDryRun) {
    return { manifest };
  }

  await writeIfChanged({ targetPath, content: renderedContent });

  return { manifest };
}