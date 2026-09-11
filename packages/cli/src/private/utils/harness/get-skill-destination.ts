import { GLOBAL_SKILLS_DIRS } from "#constants";
import init_errors from "#errors/initErrors";
import fs, { type FileRef } from "@rcompat/fs";
import { homedir } from "node:os";
import path from "node:path";

export function getSkillDestination({
  harness,
  homeDir,
}: {
  harness: string;
  homeDir?: string;
}): FileRef {
  // @ts-expect-error harness isn't typed here
  if (GLOBAL_SKILLS_DIRS[harness] === undefined) {
    throw init_errors.invalid_harness(harness);
  }

  // @ts-expect-error harness isn't typed here
  return fs.ref(path.join(homeDir ?? homedir(), GLOBAL_SKILLS_DIRS[harness]));
}