import uninstall_errors from "#errors/uninstallErrors";

export default function checkNotInternal({
  parsedType,
  name,
}: {
  parsedType: "npm" | "git" | "internal";
  name: string;
}): void {
  if (parsedType === "internal") {
    throw uninstall_errors.internal_not_uninstallable(name);
  }
}