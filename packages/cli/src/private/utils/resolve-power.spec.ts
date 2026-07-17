import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { resolvePower } from "#utils/resolve-power";
import { CodeError } from "@rcompat/error";
import { PowerErrorCode } from "#errors/powerErrors";
import {
  MAIN_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);
const activeFolder = mainFolder.append(`/${ACTIVE_FOLDER}`);
const multiUseFolder = activeFolder.append(`/${MULTI_USE_FOLDER}`);
const singleUseFolder = activeFolder.append(`/${SINGLE_USE_FOLDER}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await fs.create(activeFolder);
  await fs.create(multiUseFolder);
  await fs.create(singleUseFolder);
}

async function createPower(folder: FileRef, name: string) {
  const powerDir = folder.append(`/${name}`);
  await fs.create(powerDir);
  await powerDir.append("/instructions.json").writeJSON({
    name,
    description: "test",
    variables: { required: [] },
    intent: [],
    output: { create: [], modify: [] },
  });
}

test.case("finds a power in multi-use only", async assert => {
  await reset();
  await createPower(multiUseFolder, "my-power");

  const result = await resolvePower(testRoot, "my-power");
  assert(result.type).equals("multi-use");
  assert(result.folder.name).equals("my-power");

  await testRoot.remove();
});

test.case("finds a power in single-use only", async assert => {
  await reset();
  await createPower(singleUseFolder, "my-power");

  const result = await resolvePower(testRoot, "my-power");
  assert(result.type).equals("single-use");
  assert(result.folder.name).equals("my-power");

  await testRoot.remove();
});

test.case("throws ambiguous when power exists in both folders", async assert => {
  await reset();
  await createPower(multiUseFolder, "shared");
  await createPower(singleUseFolder, "shared");

  let threw;
  try {
    await resolvePower(testRoot, "shared");
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(PowerErrorCode.ambiguous);

  await testRoot.remove();
});

test.case("resolves with --type=multi-use when power exists in both", async assert => {
  await reset();
  await createPower(multiUseFolder, "shared");
  await createPower(singleUseFolder, "shared");

  const result = await resolvePower(testRoot, "shared", "multi-use");
  assert(result.type).equals("multi-use");

  await testRoot.remove();
});

test.case("resolves with --type=single-use when power exists in both", async assert => {
  await reset();
  await createPower(multiUseFolder, "shared");
  await createPower(singleUseFolder, "shared");

  const result = await resolvePower(testRoot, "shared", "single-use");
  assert(result.type).equals("single-use");

  await testRoot.remove();
});

test.case("throws not_found when power exists in neither", async assert => {
  await reset();

  let threw;
  try {
    await resolvePower(testRoot, "missing");
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(PowerErrorCode.not_found);

  await testRoot.remove();
});

test.case("throws not_found when --type provided but power not in that folder", async assert => {
  await reset();
  await createPower(singleUseFolder, "my-power");

  let threw;
  try {
    await resolvePower(testRoot, "my-power", "multi-use");
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(PowerErrorCode.not_found);

  await testRoot.remove();
});