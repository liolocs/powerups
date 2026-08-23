import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import setupRoot from "#utils/use/setupRoot/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should use the contextRoot if it is passed", async assert => {
  await setupTestDir();
  const contextRoot = testRoot.append("/context-root");
  await fs.create(contextRoot);

  const result = await setupRoot({
    contextRoot,
    cwd: testRoot,
    targetDir: "./test-dir",
  });

  assert(result.path).equals(contextRoot.path);
  assert(await result.exists()).true();

  await cleanup();
});

test.case("should create a directory with targetDir if it does not exist", async assert => {
  await setupTestDir();

  const result = await setupRoot({
    cwd: testRoot,
    targetDir: "./test-dir",
  });

  assert(await result.exists()).true();
  assert(result.path).equals(testRoot.path + "/test-dir");

  await cleanup();
});

test.case("should use the cwd + targetDir path if targetDir is passed", async assert => {
  await setupTestDir();

  const result = await setupRoot({
    cwd: testRoot,
    targetDir: "test-dir",
  });

  assert(result.path).equals(testRoot.path + "/test-dir");

  await cleanup();
});

test.case("should use the cwd + targetDir path if targetDir is passed with dotslash", async assert => {
  await setupTestDir();

  const result = await setupRoot({
    cwd: testRoot,
    targetDir: "./test-dir",
  });

  assert(result.path).equals(testRoot.path + "/test-dir");

  await cleanup();
});

test.case("should use the cwd + targetDir path if targetDir is passed with slash", async assert => {
  await setupTestDir();

  const result = await setupRoot({
    cwd: testRoot,
    targetDir: "/test-dir",
  });

  assert(result.path).equals(testRoot.path + "/test-dir");

  await cleanup();
});

test.case("should use the cwd if nothing else was passed", async assert => {
  await setupTestDir();

  const result = await setupRoot({
    cwd: testRoot,
  });

  assert(result.path).equals(testRoot.path);

  await cleanup();
});