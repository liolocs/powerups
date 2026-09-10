import { spawn } from "node:child_process";
import type { FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import type { SupervisorStrategy } from "#utils/preview/select-supervisor-strategy";

export type SupervisorHandle = { stop: () => void };

export async function startSupervisor({
  strategy,
  runCommand,
  previewDir,
}: {
  strategy: SupervisorStrategy;
  runCommand: string;
  previewDir: FileRef;
}): Promise<SupervisorHandle> {
  const yellow = cli.fg.yellow;

  switch (strategy.type) {
    case "nodemon": {
      let nodemonBin: string;

      try {
        nodemonBin = import.meta.resolve("nodemon/bin/nodemon.js");
      } catch {
        cli.print(`${yellow("!")} nodemon not available — running once without restart supervision\n`);
        return runCommandOnce({ runCommand, previewDir });
      }

      const child = spawn("node", [
        nodemonBin,
        "--watch", previewDir.path,
        "--exec", runCommand,
      ], { cwd: previewDir.path, stdio: "inherit" });

      child.on("error", () => {
        cli.print(`${yellow("!")} node not available — the run command was not started\n`);
      });

      return { stop: () => child.kill("SIGTERM") };
    }
    case "bun-watch": {
      const tokens = runCommand.trim().split(/\s+/);
      const child = spawn(tokens[0]!, ["--watch", ...tokens.slice(1)], {
        cwd: previewDir.path,
        stdio: "inherit",
      });

      child.on("error", () => {
        cli.print(`${yellow("!")} failed to start: ${runCommand}\n`);
      });

      return { stop: () => child.kill("SIGTERM") };
    }
    case "denon": {
      const tokens = runCommand.trim().split(/\s+/);
      const child = spawn("denon", tokens.slice(1), {
        cwd: previewDir.path,
        stdio: "inherit",
      });

      child.on("error", () => {
        cli.print(`${yellow("!")} denon not available — falling back to a single run\n`);
        void runCommandOnce({ runCommand, previewDir });
      });

      return { stop: () => child.kill("SIGTERM") };
    }
    case "run-once": {
      return runCommandOnce({ runCommand, previewDir });
    }
  }
}

export function runCommandOnce({
  runCommand,
  previewDir,
}: {
  runCommand: string;
  previewDir: FileRef;
}): SupervisorHandle {
  const child = spawn(runCommand, {
    shell: true,
    cwd: previewDir.path,
    stdio: "inherit",
  });

  child.on("error", () => {
    const yellow = cli.fg.yellow;
    cli.print(`${yellow("!")} failed to run: ${runCommand}\n`);
  });

  return { stop: () => child.kill("SIGTERM") };
}