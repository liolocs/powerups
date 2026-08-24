import checkSourceWasPassed from "#utils/install/check-for-pre-install-errors/check-source-was-passed";
import checkNotInternal from "#utils/install/check-for-pre-install-errors/check-not-internal";

export default async function checkForPreInstallErrors({
  source,
  parsedType,
  name,
  homeDir,
}: {
  source?: string;
  parsedType: "npm" | "git" | "internal";
  name: string;
  homeDir?: string;
}): Promise<void> {
  checkSourceWasPassed(source);

  await checkNotInternal({ parsedType, name, homeDir });
}