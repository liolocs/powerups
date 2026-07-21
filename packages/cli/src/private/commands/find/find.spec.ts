import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import find from "#commands/find/index";
import { CodeError } from "@rcompat/error";
import { FindErrorCode } from "#errors/findErrors";
import captureStdout from "#test-utils/capture-stdout";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  CONFIG_FILE,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
  await fs.create(testRoot.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}`));
}

async function createPackageWithPower(
  packageName: string,
  powerName: string,
  intent: string[],
  type: "multi-use" | "single-use" = "multi-use",
) {
  const typeFolder = type === "multi-use" ? MULTI_USE_FOLDER : SINGLE_USE_FOLDER;
  const pkgDir = testRoot.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${packageName}`);
  const powerDir = pkgDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}/${typeFolder}/${powerName}`);

  await fs.create(powerDir);
  await powerDir.append("/instructions.json").writeJSON({
    name: powerName,
    description: `Power for ${intent.join(" ")}`,
    variables: { required: [] },
    intent,
    output: { create: [], modify: [] },
  });

  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name: packageName,
    version: "1.0.0",
    description: "test",
    keywords: [KEYWORD_PACKAGE],
    powers: {
      active: {
        [MULTI_USE_FOLDER]: type === "multi-use"
          ? { [powerName]: [`./${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/${powerName}/instructions.json`] }
          : {},
        [SINGLE_USE_FOLDER]: type === "single-use"
          ? { [powerName]: [`./${SRC_FOLDER}/${ACTIVE_FOLDER}/${SINGLE_USE_FOLDER}/${powerName}/instructions.json`] }
          : {},
      },
    },
  });
}

async function createConfig(packages: string[]) {
  await testRoot
    .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
    .writeJSON({ harness: "claude", packages });
}

test.case("find returns matching powers from config-listed packages", async assert => {
  await reset();
  await createPackageWithPower("my-pkg", "pdf-summarizer", ["summarize", "pdf"]);
  await createConfig(["my-pkg"]);

  const output = await captureStdout(() => find.run({
    subcommands: [],
    flags: [{ flag: "--query", value: "summarize pdf" }],
    context: { root: testRoot },
  }));

  assert(output).includes("pdf-summarizer");
  assert(output).includes("my-pkg");
  assert(output).includes("local");

  await testRoot.remove();
});

test.case("find throws no_query when query is empty", async assert => {
  await reset();
  await createConfig([]);

  let threw;
  try {
    await find.run({
      subcommands: [],
      flags: [{ flag: "--query", value: "" }],
      context: { root: testRoot },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(FindErrorCode.no_query);
  await testRoot.remove();
});

test.case("find throws no_matching when no powers match", async assert => {
  await reset();
  await createPackageWithPower("my-pkg", "pdf-summarizer", ["summarize", "pdf"]);
  await createConfig(["my-pkg"]);

  let threw;
  try {
    await find.run({
      subcommands: [],
      flags: [{ flag: "--query", value: "completely-unrelated-query" }],
      context: { root: testRoot },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(FindErrorCode.no_matching);
  await testRoot.remove();
});

test.case("find does not return powers from packages not in config", async assert => {
  await reset();
  await createPackageWithPower("my-pkg", "pdf-summarizer", ["summarize", "pdf"]);
  await createConfig([]);

  let threw;
  try {
    await find.run({
      subcommands: [],
      flags: [{ flag: "--query", value: "summarize pdf" }],
      context: { root: testRoot },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(FindErrorCode.no_matching);
  await testRoot.remove();
});
test.case("find shows package name and location in output", async assert => {
  await reset();
  await createPackageWithPower("alpha-pkg", "alpha-power", ["alpha", "test"]);
  await createPackageWithPower("beta-pkg", "beta-power", ["beta", "test"]);
  await createConfig(["alpha-pkg", "beta-pkg"]);

  const output = await captureStdout(() => find.run({
    subcommands: [],
    flags: [{ flag: "--query", value: "alpha test" }],
    context: { root: testRoot },
  }));

  assert(output).includes("alpha-power");
  assert(output).includes("alpha-pkg");
  assert(output).includes("local");

  await testRoot.remove();
});
