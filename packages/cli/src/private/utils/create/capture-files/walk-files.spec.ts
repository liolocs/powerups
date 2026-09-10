import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import walkFiles from "#utils/create/capture-files/walk-files";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/walk-files");

async function createFile(dir: import("@rcompat/fs").FileRef, filePath: string, content = "x"): Promise<void> {
  const target = dir.append(`/${filePath}`);
  await fs.create(target.directory);
  await target.write(content);
}

test.case("walks nested files and returns sorted relative paths", async assert => {
  await fs.create(testRoot);
  await createFile(testRoot, "z.txt");
  await createFile(testRoot, "src/main.ts");
  await createFile(testRoot, "src/lib/helper.ts");

  const files = await walkFiles({ root: testRoot });

  assert(files).equals(["src/lib/helper.ts", "src/main.ts", "z.txt"]);

  await testRoot.remove({ recursive: true });
});

test.case("respects excluded dir names, basenames, and env files", async assert => {
  await fs.create(testRoot);
  await createFile(testRoot, "keep.txt");
  await createFile(testRoot, "node_modules/pkg/index.js");
  await createFile(testRoot, "dist/bundle.js");
  await createFile(testRoot, "pnpm-lock.yaml");
  await createFile(testRoot, ".env.local");

  const files = await walkFiles({
    root: testRoot,
    excludedDirNames: ["node_modules", "dist"],
    excludedBasenames: ["pnpm-lock.yaml"],
    excludeEnvFiles: true,
  });

  assert(files).equals(["keep.txt"]);

  await testRoot.remove({ recursive: true });
});

test.case("without exclusions, returns everything including dotfiles that are not env files", async assert => {
  await fs.create(testRoot);
  await createFile(testRoot, ".gitignore");
  await createFile(testRoot, "regular.txt");

  const files = await walkFiles({ root: testRoot });

  assert(files).equals([".gitignore", "regular.txt"]);

  await testRoot.remove({ recursive: true });
});