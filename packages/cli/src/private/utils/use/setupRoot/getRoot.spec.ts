import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import getRoot from "#utils/use/setupRoot/getRoot";

test.case("should return the contextRoot if it is passed", async assert => {
  const cwd = runtime.cwd();
  const contextRoot = fs.ref("/tmp");

  const result = await getRoot({ contextRoot, cwd, targetDir: "./test-dir" });

  assert(result.path).equals("/tmp");
});

test.case("should return the cwd + targetDir path if targetDir is passed", async assert => {
  const cwd = runtime.cwd();

  const result = await getRoot({ cwd, targetDir: "test-dir" });

  assert(result.path).equals(cwd.path + "/test-dir");
});

test.case("should return the cwd + targetDir path if targetDir is passed with dotslash", async assert => {
  const cwd = runtime.cwd();

  const result = await getRoot({ cwd, targetDir: "./test-dir" });

  assert(result.path).equals(cwd.path + "/test-dir");
});

test.case("should return the cwd + targetDir path if targetDir is passed with slash", async assert => {
  const cwd = runtime.cwd();

  const result = await getRoot({ cwd, targetDir: "/test-dir" });

  assert(result.path).equals(cwd.path + "/test-dir");
});

test.case("should return the cwd if nothing else was passed", async assert => {
  const cwd = runtime.cwd();

  const result = await getRoot({ cwd });

  assert(result.path).equals(cwd.path);
});