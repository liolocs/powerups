import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import type { Instructions } from "@liolocs/powerups-sdk";
import runPowerup from "#utils/use/run-powerup/index";
import walkFiles from "#utils/create/capture-files/walk-files";
import writeIfChanged from "#utils/shared/write-if-changed";
import type { PreviewConfig } from "#utils/preview/resolve-preview-config";
import {
  hashFile,
  readPreviewManifest,
  writePreviewManifest,
  type PreviewManifest,
} from "#utils/preview/preview-manifest";
import { computeStalePaths } from "#utils/preview/compute-stale-paths";

export default async function materializePreview({
  powerupRoot,
  instructions,
  config,
  isFirstMaterialize,
}: {
  powerupRoot: FileRef;
  instructions: Instructions;
  config: PreviewConfig;
  isFirstMaterialize: boolean;
}): Promise<{ generatedPaths: string[]; stalePaths: string[]; skippedSteps: string[] }> {
  const previewDir = powerupRoot.append(`/${config.output}`);
  await fs.create(previewDir);

  const previousManifest = await readPreviewManifest({ previewDir });
  const generatedPaths: string[] = [];
  const skippedSteps: string[] = [];

  for (const fixturePath of await listFixturePaths({ powerupRoot })) {
    const content = await powerupRoot.append(`/fixtures/${fixturePath}`).text();
    await writeIfChanged({ targetPath: previewDir.append(`/${fixturePath}`), content });
    generatedPaths.push(fixturePath);
  }

  const manifests = await runPowerup({
    destination: previewDir,
    powerupDirectory: powerupRoot,
    sourceBase: powerupRoot,
    instructions,
    isDryRun: false,
    variables: { ...config.variables },
    powerupVersion: "preview",
    powerupLocation: powerupRoot.path,
    saveManifest: false,
    overwriteExisting: true,
    skipInstallSteps: !isFirstMaterialize,
    printFinalSummary: false,
  });

  for (const manifest of manifests) {
    if (manifest.status === "skipped-warning") {
      skippedSteps.push(manifest.stepName);
      continue;
    }

    if (manifest.output.type === "create" || manifest.output.type === "modify") {
      generatedPaths.push(manifest.output.path);
    }
  }

  const stalePaths = computeStalePaths({ previousManifest, currentGeneratedPaths: generatedPaths });

  for (const stalePath of stalePaths) {
    const staleRef = previewDir.append(`/${stalePath}`);
    if (await staleRef.exists()) {
      await staleRef.remove();
    }
  }

  const newManifest: PreviewManifest = {};

  for (const generatedPath of generatedPaths) {
    newManifest[generatedPath] = await hashFile({ path: previewDir.append(`/${generatedPath}`) });
  }

  await writePreviewManifest({ previewDir, manifest: newManifest });

  return { generatedPaths, stalePaths, skippedSteps };
}

async function listFixturePaths({ powerupRoot }: { powerupRoot: FileRef }): Promise<string[]> {
  const fixturesDir = powerupRoot.append("/fixtures");

  if (!(await fixturesDir.exists())) {
    return [];
  }

  return walkFiles({ root: fixturesDir });
}
