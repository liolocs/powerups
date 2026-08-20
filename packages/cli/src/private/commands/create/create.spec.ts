import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import create from "#commands/create/create-new";
import { UseErrorCode } from "#errors/useErrors";
import { CLI_FOLDER_NAME } from "#constants";
const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should create a new powerup with the correct name", async assert => {
});