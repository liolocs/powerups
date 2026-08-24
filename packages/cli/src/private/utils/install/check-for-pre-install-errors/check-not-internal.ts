import install_errors from "#errors/installErrors";
import { readGlobalConfig, getPackageSource } from "#utils/config";

export default async function checkNotInternal({
  parsedType,
  name,
  homeDir,
}: {
  parsedType: "npm" | "git" | "internal";
  name: string;
  homeDir?: string;
}): Promise<void> {
  if (parsedType !== "internal") {
    return;
  }

  const globalConfig = await readGlobalConfig(homeDir);
  const alreadyRegistered = globalConfig?.packages.some(
    entry => getPackageSource(entry) === `internal:${name}`,
  ) ?? false;

  if (alreadyRegistered) {
    throw install_errors.global_internal_not_installable(name);
  }

  throw install_errors.internal_not_installable(name);
}