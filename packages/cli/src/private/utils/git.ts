import type { FileRef } from "@rcompat/fs";
import io from "@rcompat/io";

async function init({ cwd }: { cwd: FileRef }): Promise<void> {
  await io.run("git init", { cwd: cwd.path });
}

async function commitAll({ cwd, message }: { cwd: FileRef; message: string }): Promise<void> {
  await io.run(`git add .`, { cwd: cwd.path });
  await io.run(`git commit -m "${message}"`, { cwd: cwd.path });
}

export default {
  init,
  commitAll,
};