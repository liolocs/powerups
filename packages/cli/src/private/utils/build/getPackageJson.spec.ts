import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import { getPackageJson } from "#utils/build/getPackageJson";
import { PACKAGE_JSON } from "#constants";
import { BuildErrorCode } from "#errors/buildErrors";
import { tmpdir } from "node:os";

const root = fs.ref(tmpdir());
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("returns the parsed package.json contents", async assert => {
  await setupTestDir();

  await testRoot.append(`/${PACKAGE_JSON}`).writeJSON({
    name: "test-package-json",
    version: "2.3.4",
    description: "This is a test package.json for getPackageJson.spec.ts",
  });

  const pkgJson = await getPackageJson(testRoot.path);

  assert(pkgJson.name).equals("test-package-json");
  assert(pkgJson.version).equals("2.3.4");

  await cleanup();
});

test.case("throws when package.json does not exist", async assert => {
  await setupTestDir();

  assert(getPackageJson(testRoot))
    .throwsAsync(BuildErrorCode.no_package_json);

  await cleanup();
});
