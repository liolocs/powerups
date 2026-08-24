import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import io from "@rcompat/io";
import runnerErrors from "#errors/runnerErrors";
import type { TemplateContext } from "#template-runners/index";

export default async function tsRunner(
  { templatePath, variables }: TemplateContext,
): Promise<string> {
  if (!(await fs.exists(templatePath))) {
    throw runnerErrors.template_not_found(templatePath.name);
  }

  switch (runtime.name) {
    case "bun":
    case "deno":
      return await directImport(templatePath, variables);
    case "node":
      return await childProcessImport(templatePath, variables);
    default:
      throw runnerErrors.unsupported_runtime(runtime.name);
  }
}

/**
 * Direct import path for Bun/Deno — native TypeScript support.
 */
async function directImport(
  templatePath: FileRef,
  variables: Record<string, string>,
): Promise<string> {
  try {
    const module = await import(templatePath.path);
    if (!is.defined(module.default) || typeof module.default !== "function") {
      throw runnerErrors.invalid_ts_template(templatePath);
    }
    return String(module.default(variables));
  } catch (error_) {
    // Re-throw our own errors as-is
    if (error_ instanceof Error && error_.constructor.name === "CodeError") {
      throw error_;
    }
    throw runnerErrors.template_execution_error(
      templatePath.name,
      error_ instanceof Error ? error_.message : String(error_),
    );
  }
}

/**
 * Child process path for Node — uses --experimental-strip-types.
 * Spawns a temp .mjs runner that imports the .ts file and calls its default export.
 */
async function childProcessImport(
  templatePath: FileRef,
  variables: Record<string, string>,
): Promise<string> {
  const os = await import("node:os");

  const tmpDir = fs.ref(`${os.tmpdir()}/powerups-template-${Date.now()}`);
  await fs.create(tmpDir);

  const tmpTemplate = tmpDir.append(`/${templatePath.name}`);
  await templatePath.copy(tmpTemplate);

  const tmpRunner = tmpDir.append("/runner.mjs");
  const runnerContent = [
    `const mod = await import(process.env.powerups_TEMPLATE);`,
    `if (typeof mod.default !== "function") {`,
    `  process.stderr.write("Template must export a default function");`,
    `  process.exit(1);`,
    `}`,
    `const vars = JSON.parse(process.env.powerups_VARS);`,
    `process.stdout.write(String(mod.default(vars)));`,
  ].join("\n");
  await tmpRunner.write(runnerContent);

  try {
    const stdout = await io.run(
      `${runtime.bin} --experimental-strip-types "${tmpRunner.path}"`,
      {
        env: {
          ...process.env,
          powerups_TEMPLATE: tmpTemplate.path,
          powerups_VARS: JSON.stringify(variables),
        },
      },
    );
    return stdout;
  } catch (error_: unknown) {
    const stderr = typeof error_ === "string" ? error_ : String(error_);
    throw runnerErrors.template_execution_error(
      templatePath.name,
      stderr,
    );
  } finally {
    await tmpDir.remove();
  }
}