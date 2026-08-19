import { type FileRef } from "@rcompat/fs";
import findPackageManagerAtDestination from "#utils/use/run-powerup/steps/find-package-manager-at-destination";

export default async function getPackageManagerToUse({
  packageManager,
  destination,
}: {
  packageManager: "auto" | "pnpm" | "bun" | "yarn" | "npm";
  destination: FileRef;
}): Promise<"pnpm" | "bun" | "yarn" | "npm"> {
  const packageManagerAtDestination = await findPackageManagerAtDestination(destination);
  let packageManagerToUse: "pnpm" | "bun" | "yarn" | "npm";

  if (packageManagerAtDestination === "none") {
    packageManagerToUse = "npm";
  } else {
    packageManagerToUse = packageManagerAtDestination;
  }

  return packageManagerToUse;
}
