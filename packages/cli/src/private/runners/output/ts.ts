import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import runnerErrors from "#errors/runnerErrors";
import type { TemplateContext } from "#runners/output/index";

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
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");

  const execFileAsync = promisify(execFile);

  // Write temp runner .mjs
  const tmpFile = fs.ref(
    `${os.tmpdir()}/saved-runner-${Date.now()}.mjs`,
  );

  const runnerContent = [
    `const mod = await import(process.env.SAVED_TEMPLATE);`,
    `if (typeof mod.default !== "function") {`,
    `  process.stderr.write("Template must export a default function");`,
    `  process.exit(1);`,
    `}`,
    `const vars = JSON.parse(process.env.SAVED_VARS);`,
    `process.stdout.write(String(mod.default(vars)));`,
  ].join("\n");

  await tmpFile.write(runnerContent);

  try {
    const { stdout } = await execFileAsync(
      runtime.bin,
      ["--experimental-strip-types", tmpFile.path],
      {
        env: {
          ...process.env,
          SAVED_TEMPLATE: templatePath.path,
          SAVED_VARS: JSON.stringify(variables),
        },
      },
    );
    return stdout;
  } catch (error_: unknown) {
    const stderr = (error_ as { stderr?: string }).stderr ?? "";
    const message = error_ instanceof Error
      ? `${error_.message}${stderr ? `: ${stderr}` : ""}`
      : String(error_);
    throw runnerErrors.template_execution_error(
      templatePath.name,
      message,
    );
  } finally {
    await tmpFile.remove();
  }
}