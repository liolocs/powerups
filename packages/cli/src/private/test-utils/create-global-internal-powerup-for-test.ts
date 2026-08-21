import create from "#commands/create/index";
import { GLOBAL_INTERNAL_PATH, } from "#constants";
import { type FileRef } from "@rcompat/fs";

export default async function createGlobalInternalPowerupForTest({
  powerupName = "test-powerup",
  globalRoot,
}: {
  powerupName?: string;
  globalRoot: FileRef;
}) {
  await create.run({
    subcommands: [powerupName],
    flags: [
      { flag: "--type", value: "single-use" },
      { flag: "--description", value: "a test powerup" },
    ],
    context: { root: globalRoot },
  });

  return {
    powerupDir: globalRoot.append(`/${GLOBAL_INTERNAL_PATH}/${powerupName}`),
  };
}