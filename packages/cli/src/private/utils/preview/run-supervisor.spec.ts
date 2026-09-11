import test from "#test-utils/test/index";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fs from "@rcompat/fs";
import { startSupervisor, sweepStalePreview } from "#utils/preview/run-supervisor";

async function readStarts({ startsLog }: { startsLog: import("@rcompat/fs").FileRef }): Promise<number> {
  if (!(await startsLog.exists())) {
    return 0;
  }
  return (await startsLog.text()).split("start").length - 1;
}

async function waitForStarts({ startsLog, expected }: { startsLog: import("@rcompat/fs").FileRef; expected: number }): Promise<void> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (await readStarts({ startsLog }) >= expected) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

test.case("restart replaces the previous child process", async assert => {
  const root = fs.ref(join(tmpdir(), `supervisor-restart-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const previewDir = root.append("/preview");
  const startsLog = root.append("/starts.log");
  await fs.create(previewDir);
  await previewDir.append("/start.mjs").write([
    `import { appendFileSync } from "node:fs";`,
    `appendFileSync(process.argv[2], "start\\n");`,
    `setTimeout(() => {}, 5000);`,
  ].join("\n"));

  const supervisor = startSupervisor({ runCommand: `node start.mjs ${startsLog.path}`, previewDir });
  await waitForStarts({ startsLog, expected: 1 });
  assert(await readStarts({ startsLog })).equals(1);

  await supervisor.restart();
  await waitForStarts({ startsLog, expected: 2 });
  assert(await readStarts({ startsLog })).equals(2);

  supervisor.stop();
  await root.remove({ recursive: true });
});

test.case("stop terminates the child without further starts", async assert => {
  const root = fs.ref(join(tmpdir(), `supervisor-stop-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const previewDir = root.append("/preview");
  const startsLog = root.append("/starts.log");
  await fs.create(previewDir);
  await previewDir.append("/start.mjs").write([
    `import { appendFileSync } from "node:fs";`,
    `appendFileSync(process.argv[2], "start\\n");`,
    `setTimeout(() => {}, 5000);`,
  ].join("\n"));

  const supervisor = startSupervisor({ runCommand: `node start.mjs ${startsLog.path}`, previewDir });
  await waitForStarts({ startsLog, expected: 1 });

  supervisor.stop();
  await new Promise(resolve => setTimeout(resolve, 400));
  assert(await readStarts({ startsLog })).equals(1);

  await root.remove({ recursive: true });
});

test.case("stop kills the whole child process tree, not just the direct child", async assert => {
  const root = fs.ref(join(tmpdir(), `supervisor-tree-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const previewDir = root.append("/preview");
  const pidsLog = root.append("/pids.log");
  await fs.create(previewDir);
  await previewDir.append("/tree.mjs").write([
    `import { appendFileSync, writeFileSync } from "node:fs";`,
    `import { spawn } from "node:child_process";`,
    `const sleepChild = spawn("sleep", ["30"]);`,
    `writeFileSync(process.argv[2], String(sleepChild.pid));`,
    `setTimeout(() => {}, 5000);`,
  ].join("\n"));

  const supervisor = startSupervisor({ runCommand: `node tree.mjs ${pidsLog.path}`, previewDir });
  const deadline = Date.now() + 3000;
  while (!(await pidsLog.exists()) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const sleepPid = Number(await pidsLog.text());
  assert(sleepPid > 0).true();

  supervisor.stop();
  await new Promise(resolve => setTimeout(resolve, 500));

  assert(() => process.kill(sleepPid, 0)).throws("ESRCH");

  await root.remove({ recursive: true });
});

function isAlive(pid: number | undefined): boolean {
  if (pid === undefined) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test.case("sweepStalePreview kills the recorded stale process", async assert => {
  const root = fs.ref(join(tmpdir(), `supervisor-sweep-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const previewDir = root.append("/preview");
  await fs.create(previewDir);

  const stale = spawn("node stale.mjs", {
    shell: true,
    cwd: previewDir.path,
    detached: true,
    stdio: "ignore",
  });

  await previewDir.append("/.preview-pid").write(JSON.stringify({ pid: stale.pid, exec: "node stale.mjs" }));

  const sweptPid = await sweepStalePreview({ previewDir });

  assert(sweptPid).equals(stale.pid);

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && isAlive(stale.pid)) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  assert(!isAlive(stale.pid)).true();
  assert(!(await previewDir.append("/.preview-pid").exists())).true();

  await root.remove({ recursive: true });
});

test.case("sweepStalePreview leaves an unrelated live process alone", async assert => {
  const root = fs.ref(join(tmpdir(), `supervisor-sweep-skip-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const previewDir = root.append("/preview");
  await fs.create(previewDir);

  const unrelated = spawn("sleep 30", { shell: true, detached: true, stdio: "ignore" });
  await previewDir.append("/.preview-pid").write(JSON.stringify({ pid: unrelated.pid, exec: "wrangler dev" }));

  const sweptPid = await sweepStalePreview({ previewDir });

  assert(sweptPid === undefined).true();
  assert(isAlive(unrelated.pid)).true();

  unrelated.kill("SIGKILL");
  await root.remove({ recursive: true });
});

test.case("sweepStalePreview clears a pidfile whose process is gone", async assert => {
  const root = fs.ref(join(tmpdir(), `supervisor-sweep-dead-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const previewDir = root.append("/preview");
  await fs.create(previewDir);

  const exited = spawn("true", { shell: true, detached: true, stdio: "ignore" });
  await new Promise<void>(resolve => {
    exited.once("exit", () => resolve());
  });

  await previewDir.append("/.preview-pid").write(JSON.stringify({ pid: exited.pid, exec: "true" }));

  const sweptPid = await sweepStalePreview({ previewDir });

  assert(sweptPid === undefined).true();
  assert(!(await previewDir.append("/.preview-pid").exists())).true();

  await root.remove({ recursive: true });
});