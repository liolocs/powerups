import fs from "@rcompat/fs";
import os from "node:os";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import type { FileRef } from "@rcompat/fs";
import type { Instructions } from "@liolocs/powerups-sdk";
import preview_errors from "#errors/previewErrors";

export default async function loadInstructionsFromSource({
  powerupRoot,
}: {
  powerupRoot: FileRef;
}): Promise<Instructions> {
  const indexFilePath = powerupRoot.append("/index.ts");

  if (!(await indexFilePath.exists())) {
    throw preview_errors.instructions_not_found(powerupRoot.path);
  }

  switch (runtime.name) {
    case "bun":
    case "deno":
      return await directImport(indexFilePath);
    case "node":
      return await childProcessImport(indexFilePath);
    default:
      throw new Error(`Unsupported runtime: ${runtime.name}`);
  }
}

async function directImport(indexFilePath: FileRef): Promise<Instructions> {
  const module = await import(`${indexFilePath.path}?t=${Date.now()}`) as {
    default?: { instructions?: Instructions };
  };
  return getInstructions(module);
}

async function childProcessImport(indexFilePath: FileRef): Promise<Instructions> {
  const tmpDir = fs.ref(`${os.tmpdir()}/powerups-source-${Date.now()}`);
  await fs.create(tmpDir);

  const runner = tmpDir.append("/runner.mjs");
  const runnerContent = [
    `const mod = await import(process.env.powerups_INDEX);`,
    `if (!mod.default || !mod.default.instructions) {`,
    `  process.stderr.write("index.ts must default-export defineInstructions(...)");`,
    `  process.exit(1);`,
    `}`,
    `process.stdout.write(JSON.stringify(mod.default.instructions));`,
  ].join("\n");
  await runner.write(runnerContent);

  try {
    const stdout = await io.run(
      `${runtime.bin} --experimental-strip-types "${runner.path}"`,
      { env: { ...process.env, powerups_INDEX: indexFilePath.path } },
    );

    return JSON.parse(stdout) as Instructions;
  } finally {
    await tmpDir.remove({ recursive: true });
  }
}

function getInstructions(module: { default?: { instructions?: Instructions } }): Instructions {
  const instructions = module.default?.instructions;

  if (instructions === undefined) {
    throw new Error("index.ts must default-export defineInstructions(...)");
  }

  return instructions;
}
