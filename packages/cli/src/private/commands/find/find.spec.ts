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
  CLI_NAME,
  CAPITALIZED_SINGLULAR_CLI_NAME,
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
  powerupsName: string,
  intent: string[],
  type: "multi-use" | "single-use" = "multi-use",
) {
  const typeFolder = type === "multi-use" ? MULTI_USE_FOLDER : SINGLE_USE_FOLDER;
  const pkgDir = testRoot.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${packageName}`);
  const powerDir = pkgDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}/${typeFolder}/${powerupsName}`);

  await fs.create(powerDir);
  await powerDir.append("/instructions.json").writeJSON({
    name: powerupsName,
    description: `${CAPITALIZED_SINGLULAR_CLI_NAME} for ${intent.join(" ")}`,
    variables: { required: [] },
    intent,
    steps: [],
  });

  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name: packageName,
    version: "1.0.0",
    description: "test",
    keywords: [KEYWORD_PACKAGE],
    [CLI_NAME]: {
      active: {
        [MULTI_USE_FOLDER]: type === "multi-use"
          ? { [powerupsName]: `./${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/${powerupsName}/instructions.json` }
          : {},
        [SINGLE_USE_FOLDER]: type === "single-use"
          ? { [powerupsName]: `./${SRC_FOLDER}/${ACTIVE_FOLDER}/${SINGLE_USE_FOLDER}/${powerupsName}/instructions.json` }
          : {},
      },
    },
  });
}

async function createConfig(packages: string[]) {
  await testRoot
    .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
    .writeJSON({ packages });
}

test.case(`find returns matching ${CLI_NAME} from config-listed packages`, async assert => {
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

test.case(`find throws no_matching when no ${CLI_NAME} match`, async assert => {
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

test.case(`find does not return ${CLI_NAME} from packages not in config`, async assert => {
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
  await createPackageWithPower("alpha-pkg", "alpha-powerup", ["alpha", "test"]);
  await createPackageWithPower("beta-pkg", "beta-powerup", ["beta", "test"]);
  await createConfig(["alpha-pkg", "beta-pkg"]);

  const output = await captureStdout(() => find.run({
    subcommands: [],
    flags: [{ flag: "--query", value: "alpha test" }],
    context: { root: testRoot },
  }));

  assert(output).includes("alpha-powerup");
  assert(output).includes("alpha-pkg");
  assert(output).includes("local");

  await testRoot.remove();
});
