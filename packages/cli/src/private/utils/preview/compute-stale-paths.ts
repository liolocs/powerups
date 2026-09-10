import type { PreviewManifest } from "#utils/preview/preview-manifest";

export function computeStalePaths({
  previousManifest,
  currentGeneratedPaths,
}: {
  previousManifest: PreviewManifest;
  currentGeneratedPaths: string[];
}): string[] {
  const current = new Set(currentGeneratedPaths);

  return Object.keys(previousManifest).filter(path => !current.has(path));
}
