import { type FileRef } from "@rcompat/fs";

export default async function findPackageManagerAtDestination(cwd: FileRef): Promise<"pnpm" | "bun" | "yarn" | "npm" | "none"> {
  const pnpmLockPath = cwd.append("/pnpm-lock.yaml");
  if (await pnpmLockPath.exists()) {
    return "pnpm";
  }

  const oldBunLockPath = cwd.append("/bun.lockb");
  const bunLockPath = cwd.append("/bun.lock");
  if (await bunLockPath.exists() || await oldBunLockPath.exists()) {
    return "bun";
  }

  const yarnLockPath = cwd.append("/yarn.lock");
  if (await yarnLockPath.exists()) {
    return "yarn";
  };

  const npmLockPath = cwd.append("/package-lock.json");
  if (await npmLockPath.exists()) {
    return "npm";
  };

  return "none";
}