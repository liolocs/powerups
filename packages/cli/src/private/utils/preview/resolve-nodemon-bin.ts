import { createRequire } from "node:module";
import type { FileRef } from "@rcompat/fs";

export default function resolveNodemonBin({ powerupRoot }: { powerupRoot: FileRef }): string {
  const requireFromPowerup = createRequire(powerupRoot.append("/package.json").path);

  return requireFromPowerup.resolve("nodemon/bin/nodemon.js");
}