import test from "@rcompat/test";
import init from "#commands/init";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { MAIN_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);

test.case(`init generates a ${MAIN_FOLDER} folder`, async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  await init.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  });

  const hasDryFolder = await fs.exists(mainFolder);
  assert(hasDryFolder).equals(true);

  await testRoot.remove();

  const hasDryFolderAgain = await fs.exists(mainFolder);
  assert(hasDryFolderAgain).equals(false);
});