import test from "#test-utils/test/index";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fs from "@rcompat/fs";
import { startSupervisor } from "#utils/preview/run-supervisor";

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