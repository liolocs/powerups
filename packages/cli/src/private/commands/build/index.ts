import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import { powerupPropertySchema, instructionsSchema } from "@liolocs/powerups-sdk";
import build_errors from "#errors/buildErrors";
import {
  SINGULAR_NAME,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
} from "#constants";

export async function buildPowerup(cwd: FileRef): Promise<void> {
  // 1. Read package.json
  const packageJsonRef = cwd.append(`/${PACKAGE_FILE}`);

  if (!(await packageJsonRef.exists())) {
    throw build_errors.no_package_json();
  }

  const pkgJson = await packageJsonRef.json() as Record<string, unknown>;

  // 2. Guard: confirm this is a powerups package
  const keywords = pkgJson.keywords;
  if (!Array.isArray(keywords) || !keywords.includes(KEYWORD_PACKAGE)) {
    throw build_errors.not_a_powerups_package();
  }

  // 3. Validate the powerup property
  const powerupResult = powerupPropertySchema.safeParse(
    pkgJson[SINGULAR_NAME],
  );

  if (!powerupResult.success) {
    throw build_errors.malformed_powerup_property(powerupResult.error.message);
  }

  const instructionsPath = powerupResult.data.instructions;
  const tsFileRef = cwd.append(`/${instructionsPath}`);

  // 4. Execute the TS file
  const module = await tsFileRef.import();

  if (typeof module.default !== "function") {
    throw build_errors.invalid_instructions_file(tsFileRef.name);
  }

  const instructions = module.default();

  // 5. Validate the instructions
  const instructionsResult = instructionsSchema.safeParse(instructions);

  if (!instructionsResult.success) {
    throw build_errors.malformed_instructions(instructionsResult.error.message);
  }

  const validated = instructionsResult.data;

  // 6. Create dist folder (clean rebuild)
  const distRef = cwd.append("/dist");

  if (await distRef.exists()) {
    await distRef.remove({ recursive: true });
  }

  await distRef.create();

  // 7. Write instructions.json
  await distRef.append("/instructions.json").writeJSON(validated);

  // 8. Copy template files
  const templatePaths = new Set<string>();

  for (const step of validated.steps) {
    if (step.type === "create" || step.type === "modify") {
      templatePaths.add(step.template);
    } else if (step.type === "read" && step.template) {
      templatePaths.add(step.template);
    }
  }

  for (const templatePath of templatePaths) {
    const srcRef = cwd.append(`/${templatePath}`);
    const destRef = distRef.append(`/${templatePath}`);

    if (!(await srcRef.exists())) {
      throw build_errors.template_not_found(templatePath);
    }

    await destRef.directory.create();
    await srcRef.copy(destRef);
  }

  // 9. Print success
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  const name = typeof pkgJson.name === "string" ? pkgJson.name : SINGULAR_NAME;
  cli.print(`${green("✓")} Built ${SINGULAR_NAME}: ${name}\n`);
  cli.print(`  ${dim("output:")} ${distRef.path}\n`);
}

const build = new Command({
  name: "build",
  description: `Build a ${SINGULAR_NAME} for distribution`,
  flags: [],
  subcommands: [],
  action: async () => {
    await buildPowerup(runtime.cwd());
  },
});

export default build;