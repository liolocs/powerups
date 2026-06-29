import test from "@rcompat/test";
import init from "#init";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";

const root = await runtime.projectRoot();
const dryFolder = root.append("/.dry");

test.case("init generates a .dry folder", async assert => {
  await init.run();

  const hasDryFolder = await fs.exists(dryFolder);
  assert(hasDryFolder).equals(true);

  await dryFolder.remove();

  const hasDryFolderAgain = await fs.exists(dryFolder);
  assert(hasDryFolderAgain).equals(false);
});