import fs from "@rcompat/fs";
import os from "node:os";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import type { FileRef } from "@rcompat/fs";
import type { Instructions } from "@liolocs/powerups-sdk";
import preview_errors from "#errors/previewErrors";
import getInstructionsEntry from "#utils/preview/get-instructions-entry";

export default async function loadInstructionsFromSource({
  powerupRoot,
}: {
  powerupRoot: FileRef;
}): Promise<Instructions> {
  const entryFile = await getInstructionsEntry({ powerupRoot });
  const entryFilePath = powerupRoot.append(`/${entryFile}`);

  if (!(await entryFilePath.exists())) {
    throw preview_errors.instructions_not_found(powerupRoot.path, entryFile);
  }

  switch (runtime.name) {
    case "bun":
    case "deno":
      return await directImport({ entryFilePath, entryFile });
    case "node":
      return await childProcessImport({ entryFilePath, entryFile });
    default:
      throw new Error(`Unsupported runtime: ${runtime.name}`);
  }
}

async function directImport({
  entryFilePath,
  entryFile,
}: {
  entryFilePath: FileRef;
  entryFile: string;
}): Promise<Instructions> {
  const module = await import(`${entryFilePath.path}?t=${Date.now()}`) as {
    default?: { instructions?: Instructions };
  };
  return getInstructions(module, entryFile);
}

async function childProcessImport({
  entryFilePath,
  entryFile,
}: {
  entryFilePath: FileRef;
  entryFile: string;
}): Promise<Instructions> {
  const tmpDir = fs.ref(`${os.tmpdir()}/powerups-source-${Date.now()}`);
  await fs.create(tmpDir);

  const runner = tmpDir.append("/runner.mjs");
  const runnerContent = [
    `const mod = await import(process.env.powerups_INDEX);`,
    `if (!mod.default || !mod.default.instructions) {`,
    `  process.stderr.write("${entryFile} must default-export defineInstructions(...)");`,
    `  process.exit(1);`,
    `}`,
    `process.stdout.write(JSON.stringify(mod.default.instructions));`,
  ].join("\n");
  await runner.write(runnerContent);

  try {
    const stdout = await io.run(
      `${runtime.bin} --experimental-strip-types "${runner.path}"`,
      { env: { ...process.env, powerups_INDEX: entryFilePath.path } },
    );

    return JSON.parse(stdout) as Instructions;
  } finally {
    await tmpDir.remove({ recursive: true });
  }
}

function getInstructions(
  module: { default?: { instructions?: Instructions } },
  entryFile: string,
): Instructions {
  const instructions = module.default?.instructions;

  if (instructions === undefined) {
    throw new Error(`${entryFile} must default-export defineInstructions(...)`);
  }

  return instructions;
}
