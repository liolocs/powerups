import type { DeleteManifestEntry, DeleteStep } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import resolveOutputPath from "#utils/use/run-powerup/steps/shared/resolve-output-path";

export default async function runDeleteStep({
  step,
  isDryRun,
  destination,
  powerupDirectory,
  variables,
}: {
  step: DeleteStep;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}): Promise<{ manifest: Omit<DeleteManifestEntry, BaseManifestProperties> }> {
  const resolvedOutputPath = resolveOutputPath({
    outputPath: step.outputPath,
    variables,
  });

  const manifest: Omit<DeleteManifestEntry, BaseManifestProperties> = {
    timestamp: new Date(),
    stepName: step.name,
    from: step.from?.name,
    stepType: "delete",
    status: "applied",
    output: {
      type: "delete",
      path: resolvedOutputPath,
    },
  };

  const targetPath = destination.append(`/${resolvedOutputPath}`);

  if (!(await fs.exists(targetPath))) {
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

  await targetPath.remove();

  return { manifest };
}