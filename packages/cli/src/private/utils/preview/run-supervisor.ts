import { spawn, type ChildProcess } from "node:child_process";
import type { FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";

export type SupervisorHandle = { restart: () => Promise<void>; stop: () => void };

export function startSupervisor({
  runCommand,
  previewDir,
}: {
  runCommand: string;
  previewDir: FileRef;
}): SupervisorHandle {
  if (runCommand.trim() === "") {
    const yellow = cli.fg.yellow;
    cli.print(`${yellow("!")} empty run command — nothing was started\n`);
    return { restart: async () => {}, stop: () => {} };
  }

  let child = spawnCommand({ runCommand, previewDir });

  return {
    restart: async () => {
      if (child.exitCode !== null) {
        child = spawnCommand({ runCommand, previewDir });
        return;
      }

      const exited = new Promise<void>(resolve => {
        child.once("exit", () => resolve());
      });
      child.kill("SIGTERM");
      await exited;
      child = spawnCommand({ runCommand, previewDir });
    },
    stop: () => child.kill("SIGTERM"),
  };
}

function spawnCommand({
  runCommand,
  previewDir,
}: {
  runCommand: string;
  previewDir: FileRef;
}): ChildProcess {
  const child = spawn(runCommand, { shell: true, cwd: previewDir.path, stdio: "inherit" });

  child.on("error", () => {
    const yellow = cli.fg.yellow;
    cli.print(`${yellow("!")} failed to run: ${runCommand}\n`);
  });

  return child;
}

export function runCommandOnce({
  runCommand,
  previewDir,
}: {
  runCommand: string;
  previewDir: FileRef;
}): SupervisorHandle {
  if (runCommand.trim() === "") {
    return { restart: async () => {}, stop: () => {} };
  }

  const child = spawnCommand({ runCommand, previewDir });

  return { restart: async () => {}, stop: () => child.kill("SIGTERM") };
}