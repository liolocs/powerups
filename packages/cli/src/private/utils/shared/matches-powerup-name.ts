import type { PackageEntry } from "@liolocs/powerups-sdk";

export default function matchesPowerupName(
  entry: PackageEntry,
  powerupName: string,
): boolean {
  if (typeof entry === "string") {
    return entry.split(":")[1] === powerupName;
  }
  if (entry.name !== undefined) {
    return entry.name === powerupName;
  }
  return entry.package.split(":")[1] === powerupName;
}