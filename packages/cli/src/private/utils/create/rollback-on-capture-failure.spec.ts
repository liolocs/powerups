import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import runCaptureWithRollback from "#utils/create/rollback-on-capture-failure";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/rollback");

test.case("rethrows the capture error after removing the partially created powerup dir", async assert => {
  await testRoot.remove({ recursive: true }).catch(() => {});
  await fs.create(testRoot);
  const newPowerupDirectory = testRoot.append("/my-powerup");
  await fs.create(newPowerupDirectory);
  await newPowerupDirectory.append("/index.ts").write("export default 1;\n");

  let threw = "";
  try {
    await runCaptureWithRollback({
      capture: async () => {
        throw new Error("git exploded");
      },
      newPowerupDirectory,
      isDryRun: false,
    });
  } catch (error) {
    threw = (error as Error).message;
  }

  assert(threw).equals("git exploded");
  assert(await newPowerupDirectory.exists()).false();

  await testRoot.remove({ recursive: true });
});

test.case("keeps the powerup dir when capture succeeds", async assert => {
  await testRoot.remove({ recursive: true }).catch(() => {});
  await fs.create(testRoot);
  const newPowerupDirectory = testRoot.append("/ok-powerup");
  await fs.create(newPowerupDirectory);

  const result = await runCaptureWithRollback({
    capture: async () => "captured",
    newPowerupDirectory,
    isDryRun: false,
  });

  assert(result).equals("captured");
  assert(await newPowerupDirectory.exists()).true();

  await testRoot.remove({ recursive: true });
});

test.case("does not delete anything on dry runs", async assert => {
  await testRoot.remove({ recursive: true }).catch(() => {});
  await fs.create(testRoot);
  const newPowerupDirectory = testRoot.append("/dry-powerup");
  await fs.create(newPowerupDirectory);

  await runCaptureWithRollback({
    capture: async () => {
      throw new Error("boom");
    },
    newPowerupDirectory,
    isDryRun: true,
  }).catch(() => {});

  assert(await newPowerupDirectory.exists()).true();

  await testRoot.remove({ recursive: true });
});