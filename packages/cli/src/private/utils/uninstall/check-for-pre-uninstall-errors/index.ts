import checkNameWasPassed from "#utils/uninstall/check-for-pre-uninstall-errors/check-name-was-passed";
import checkNotInternal from "#utils/uninstall/check-for-pre-uninstall-errors/check-not-internal";

export default async function checkForPreUninstallErrors({
  name,
  parsedType,
}: {
  name?: string;
  parsedType: "npm" | "git" | "internal";
}): Promise<void> {
  checkNameWasPassed(name);

  checkNotInternal({ parsedType, name: name! });
}