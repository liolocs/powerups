import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import { powerupPropertySchema, instructionsSchema, type Instructions, type Step } from "@liolocs/powerups-sdk";
import build_errors from "#errors/buildErrors";
import { validateInstructions } from "#utils/build-validation";
import { resolveTsup } from "#utils/tsup-resolver";
import { SINGULAR_NAME, PACKAGE_FILE, KEYWORD_PACKAGE } from "#constants";

function fileUrlToDir(sourceUrl: string): FileRef {
  // sourceUrl is import.meta.url of a dist/index.js — walk up to the package root
  const path = sourceUrl.startsWith("file://") ? sourceUrl.slice(7) : sourceUrl;
  return fs.ref(path).directory;
}

async function resolvePackageDir(sourceUrl: string): Promise<FileRef> {
  let dir = fileUrlToDir(sourceUrl);
  for (let i = 0; i < 20; i++) {
    if (await fs.exists(dir.append(`/${PACKAGE_FILE}`))) {
      return dir;
    }
    dir = dir.up(1);
  }
  throw new Error(`Could not resolve package directory from ${sourceUrl}`);
}

function stripSource(steps: Step[]): Step[] {
  return steps.map(step => {
    const { __source: _omit, ...rest } = step as Step & { __source?: string };
    return rest as Step;
  });
}

/** Collect every dependency name declared in package.json, to keep them external. */
function collectExternals(pkgJson: Record<string, unknown>): string[] {
  const externals: string[] = [];
  for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
    const deps = pkgJson[key] as Record<string, string> | undefined;
    if (deps && typeof deps === "object") {
      externals.push(...Object.keys(deps));
    }
  }
  return externals;
}

export async function buildPowerup(cwd: FileRef): Promise<void> {
  const packageJsonRef = cwd.append(`/${PACKAGE_FILE}`);
  if (!(await packageJsonRef.exists())) {
    throw build_errors.no_package_json();
  }

  const pkgJson = await packageJsonRef.json() as Record<string, unknown>;
  const keywords = pkgJson.keywords;
  if (!Array.isArray(keywords) || !keywords.includes(KEYWORD_PACKAGE)) {
    throw build_errors.not_a_powerups_package();
  }

  const powerupResult = powerupPropertySchema.safeParse(pkgJson[SINGULAR_NAME]);
  if (!powerupResult.success) {
    throw build_errors.malformed_powerup_property(powerupResult.error.message);
  }

  const entryPath = powerupResult.data.instructions;
  const distRef = cwd.append("/dist");
  const distIndex = distRef.append("/index.js");

  // 1. Compile with tsup (dts: true, ESM, all declared deps external)
  const tsup = await resolveTsup(cwd);
  if (await distRef.exists()) {
    await distRef.remove({ recursive: true });
  }
  await distRef.create();

  await tsup.build({
    entry: [entryPath],
    outDir: "dist",
    format: ["esm"],
    dts: true,
    external: collectExternals(pkgJson),
    splitting: false,
    clean: false,
    silent: true,
  });

  if (!(await fs.exists(distIndex))) {
    throw build_errors.invalid_instructions_file(entryPath);
  }

  // 2. Import compiled dist/index.js → { instructions, source }
  const compiled = await import(distIndex.path);
  if (
    !compiled.default ||
    typeof compiled.default !== "object" ||
    !compiled.default.instructions
  ) {
    throw build_errors.invalid_instructions_file(entryPath);
  }
  const { instructions, source } = compiled.default as { instructions: Instructions; source: string };

  // 3. Validate schema
  const schemaResult = instructionsSchema.safeParse(instructions);
  if (!schemaResult.success) {
    throw build_errors.malformed_instructions(schemaResult.error.message);
  }
  const validated = schemaResult.data;

  // 4. Build-time validation
  const validationIssues = await validateInstructions(validated, { outputFolder: distRef });
  if (validationIssues.length > 0) {
    throw build_errors.build_validation_failed(validationIssues);
  }

  // 5. Write instructions.json (strip __source; keep from, variableMap)
  const serializable = { ...validated, steps: stripSource(validated.steps) };
  await distRef.append("/instructions.json").writeJSON(serializable);

  // 6. Copy own templates (templates not starting with _internal/)
  for (const step of validated.steps) {
    const tmpl = (step as Step & { template?: string }).template;
    if (!tmpl || tmpl.startsWith("_internal/")) continue;
    const src = cwd.append(`/${tmpl}`);
    if (!(await fs.exists(src))) {
      throw build_errors.template_not_found(tmpl);
    }
    const dest = distRef.append(`/${tmpl}`);
    await dest.directory.create();
    await src.copy(dest);
  }

  // 7. Copy _internal templates from each step's __source package dist/
  const copied = new Set<string>();
  for (const step of validated.steps) {
    const tmpl = (step as Step & { template?: string }).template;
    if (!tmpl || !tmpl.startsWith("_internal/")) continue;
    if (copied.has(tmpl)) continue;
    copied.add(tmpl);

    const __source = (step as Step & { __source?: string }).__source ?? source;
    const pkgDir = await resolvePackageDir(__source);
    // subpath after _internal/<namespace>/
    const subpath = tmpl.split("/").slice(2).join("/");
    const src = pkgDir.append(`/dist/${subpath}`);
    if (!(await fs.exists(src))) {
      throw build_errors.child_not_built(tmpl.split("/")[1]);
    }
    const dest = distRef.append(`/${tmpl}`);
    await dest.directory.create();
    await src.copy(dest);
  }

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