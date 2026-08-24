import type { FileRef } from "@rcompat/fs";
import type { ParsedSource } from "#utils/install/parse-source/index";
import fetchNpmPackage from "#utils/install/fetch-package/fetch-npm-package";
import fetchGitPackage from "#utils/install/fetch-package/fetch-git-package";

export default async function fetchPackage({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  switch (parsedSource.type) {
    case "npm":
      return fetchNpmPackage({ powerupDir, parsedSource });
    case "git":
      return fetchGitPackage({ powerupDir, parsedSource });
    default:
      return;
  }
}