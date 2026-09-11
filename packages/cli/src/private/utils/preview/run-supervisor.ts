import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import type { FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";

export type SupervisorHandle = { restart: () => Promise<void>; stop: () => void };

const PID_FILE = ".preview-pid";
const KILL_GRACE_MS = 2000;
const KILL_POLL_MS = 50;

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
      const previousPid = child.pid;
      killTree({ pid: child.pid });
      await exited;
      await waitForProcessGroupExit({ pid: previousPid });
      child = spawnCommand({ runCommand, previewDir });
    },
    stop: () => {
      killTree({ pid: child.pid });
      removePidFile({ previewDir });
    },
  };
}

export async function sweepStalePreview({
  previewDir,
}: {
  previewDir: FileRef;
}): Promise<number | undefined> {
  const pidFile = previewDir.append(`/${PID_FILE}`);

  if (!(await pidFile.exists())) {
    return undefined;
  }

  let record: { pid: number; exec: string } | undefined;

  try {
    record = parsePidRecord({ content: await pidFile.text() });
  } catch {
    record = undefined;
  }

  if (record === undefined) {
    await pidFile.remove();
    return undefined;
  }

  const killed = await killStaleProcess({ pid: record.pid, exec: record.exec });
  await pidFile.remove();

  return killed ? record.pid : undefined;
}

async function killStaleProcess({ pid, exec }: { pid: number; exec: string }): Promise<boolean> {
  if (!isProcessAlive({ pid })) {
    return false;
  }

  if (process.platform !== "win32" && !isStaleCommand({ pid, exec })) {
    return false;
  }

  killTree({ pid });
  await waitForProcessGroupExit({ pid });

  return true;
}

async function waitForProcessGroupExit({ pid }: { pid: number | undefined }): Promise<void> {
  if (pid === undefined || process.platform === "win32") {
    return;
  }

  if (await awaitProcessGroupExit({ pid })) {
    return;
  }

  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    return;
  }

  await awaitProcessGroupExit({ pid });
}

async function awaitProcessGroupExit({ pid }: { pid: number }): Promise<boolean> {
  const deadline = Date.now() + KILL_GRACE_MS;

  while (Date.now() < deadline) {
    if (!isProcessGroupAlive({ pid })) {
      return true;
    }

    await sleep({ ms: KILL_POLL_MS });
  }

  return !isProcessGroupAlive({ pid });
}

function sleep({ ms }: { ms: number }): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function isProcessGroupAlive({ pid }: { pid: number }): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function isProcessAlive({ pid }: { pid: number }): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function isStaleCommand({ pid, exec }: { pid: number; exec: string }): boolean {
  try {
    const command = execFileSync(
      "ps",
      ["-ww", "-p", String(pid), "-o", "command="],
      { encoding: "utf8" },
    ).trim();
    return command.includes(exec.trim());
  } catch {
    return false;
  }
}

function parsePidRecord({ content }: { content: string }): { pid: number; exec: string } | undefined {
  const parsed = JSON.parse(content) as { pid?: unknown; exec?: unknown };

  if (typeof parsed.pid !== "number" || typeof parsed.exec !== "string") {
    return undefined;
  }

  return { pid: parsed.pid, exec: parsed.exec };
}

function killTree({ pid }: { pid: number | undefined }): void {
  if (pid === undefined) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"]);
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      return;
    }
  }
}

function spawnCommand({
  runCommand,
  previewDir,
}: {
  runCommand: string;
  previewDir: FileRef;
}): ChildProcess {
  const child = spawn(runCommand, {
    shell: true,
    cwd: previewDir.path,
    stdio: "inherit",
    detached: true,
  });

  writePidFile({ previewDir, pid: child.pid, exec: runCommand });

  child.on("error", () => {
    const yellow = cli.fg.yellow;
    cli.print(`${yellow("!")} failed to run: ${runCommand}\n`);
  });

  return child;
}

function writePidFile({
  previewDir,
  pid,
  exec,
}: {
  previewDir: FileRef;
  pid: number | undefined;
  exec: string;
}): void {
  if (pid === undefined) {
    return;
  }

  const record = JSON.stringify({ pid, exec });

  try {
    writeFileSync(previewDir.append(`/${PID_FILE}`).path, record);
  } catch {
    return;
  }
}

function removePidFile({ previewDir }: { previewDir: FileRef }): void {
  previewDir.append(`/${PID_FILE}`).remove().catch(() => undefined);
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

  return {
    restart: async () => {},
    stop: () => {
      killTree({ pid: child.pid });
      removePidFile({ previewDir });
    },
  };
}