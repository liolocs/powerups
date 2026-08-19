import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import is from "@rcompat/is";
import type { JSONValue } from "@rcompat/type";
import type { Step } from "@liolocs/powerups-sdk";
import type { ResolvedVariable } from "#utils/variables";
import { resolveTemplateString } from "#utils/resolve-template-string";
import { runTemplate } from "#template-runners/index";
import { applyMultipleModifications } from "#utils/modify-engine";
import use_errors from "#errors/useErrors";

export function navigateJsonPath(json: unknown, path: string): string {
  const parts = path.split(".");
  let current: unknown = json;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      throw new Error(`JSON path "${path}" not found`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (current === undefined || current === null) {
    throw new Error(`JSON path "${path}" not found`);
  }
  return String(current);
}

export interface RunRecord {
  steps: { name: string; type: string; status: "applied" | "skipped-warning" | "skipped-already-applied"; from?: string }[];
  files: { path: string; action: "create" | "modify" | "delete" }[];
  totalCharacters: number;
}

export interface ExecuteStepsArgs {
  steps: Step[];
  variables: ResolvedVariable;
  outputFolder: FileRef;
  rootDir: FileRef;
  isDryRun: boolean;
  isOverwrite: boolean;
  record: RunRecord;
}

export function resolveStepVariables(
  step: Step,
  variables: ResolvedVariable,
): ResolvedVariable {
  const map = (step as Step & { variableMap?: Record<string, string> }).variableMap;
  if (!map) {
    return variables;
  }
  const stepVars: ResolvedVariable = { ...variables };
  for (const [key, value] of Object.entries(map)) {
    stepVars[key] = resolveTemplateString(value, stepVars);
  }
  return stepVars;
}

function fromOf(step: Step): string | undefined {
  return (step as Step & { from?: { name: string } }).from?.name;
}

const LOCK_FILES = [
  { file: "pnpm-lock.yaml", command: "pnpm install" },
  { file: "package-lock.json", command: "npm install" },
  { file: "yarn.lock", command: "yarn install" },
  { file: "bun.lockb", command: "bun install" },
  { file: "bun.lock", command: "bun install" },
];

function parseDepName(spec: string): string {
  if (
    spec.startsWith("file:") || spec.startsWith("link:") ||
    spec.startsWith("git+") || spec.startsWith("workspace:")
  ) {
    return spec;
  }
  const lastAt = spec.lastIndexOf("@");
  if (lastAt > 0) {
    return spec.slice(0, lastAt);
  }
  return spec;
}

function depVersion(spec: string): string {
  const name = parseDepName(spec);
  return spec.slice(name.length + 1) || "*";
}

async function handleInstall(
  step: Extract<Step, { type: "install" }>,
  stepVars: ResolvedVariable,
  rootDir: FileRef,
  isDryRun: boolean,
): Promise<"applied" | "skipped-warning"> {
  const target = step.target ? resolveTemplateString(step.target, stepVars) : "";
  const pkgPath = target ? rootDir.append(`/${target}/package.json`) : rootDir.append("/package.json");
  const label = target || "root";

  const sections: { key: "dependencies" | "devDependencies" | "peerDependencies"; deps?: string[] }[] = [
    { key: "dependencies", deps: step.dependencies },
    { key: "devDependencies", deps: step.devDependencies },
    { key: "peerDependencies", deps: step.peerDependencies },
  ];

  if (isDryRun) {
    cli.print(`=== install for ${label} ===\n`);
    for (const s of sections) {
      if (s.deps && s.deps.length > 0) {
        cli.print(`  ${s.key}: ${s.deps.map(d => resolveTemplateString(d, stepVars)).join(", ")}\n`);
      }
    }
    return "applied";
  }

  if (!(await fs.exists(pkgPath))) {
    cli.print(`Warning: target package.json not found at ${label}, skipping install step.\n`);
    return "skipped-warning";
  }

  const pkg = await pkgPath.json() as Record<string, JSONValue>;
  let allSkipped = true;
  let wrote = false;

  for (const s of sections) {
    if (!s.deps || s.deps.length === 0) continue;
    const existing = (pkg[s.key] as Record<string, string> | undefined) ?? {};
    const merged = { ...existing };
    for (const raw of s.deps) {
      const resolved = resolveTemplateString(raw, stepVars);
      const name = parseDepName(resolved);
      if (is.defined(existing[name])) {
        cli.print(`Warning: ${name} already in ${label} ${s.key} — skipping\n`);
        continue;
      }
      merged[name] = depVersion(resolved);
      allSkipped = false;
    }
    if (Object.keys(merged).length !== Object.keys(existing).length) {
      pkg[s.key] = merged;
      wrote = true;
    }
  }

  if (wrote) {
    await pkgPath.writeJSON(pkg);
    cli.print(`Updated ${label}/package.json\n`);
  }

  let command: string | null = null;
  for (const { file, command: cmd } of LOCK_FILES) {
    if (await fs.exists(rootDir.append(`/${file}`))) {
      command = cmd;
      break;
    }
  }

  if (!command) {
    cli.print(
      "Warning: No lock file detected. package.json has been updated, but dependencies were not installed. " +
      "Run your package manager's install command manually.\n",
    );
    return allSkipped ? "skipped-warning" : "applied";
  }

  try {
    cli.print(`Running ${command}...\n`);
    const stdout = await io.run(command, { cwd: rootDir.path });
    if (is.truthy(stdout)) {
      cli.print(stdout);
    }
    cli.print("Dependency installation complete.\n");
  } catch (e) {
    if (typeof e === "string" && is.truthy(e)) {
      cli.print(e);
    }
    cli.print(
      `Warning: Dependency installation failed. Generated files are in place. ` +
      `Please run '${command}' manually.\n`,
    );
  }

  return allSkipped ? "skipped-warning" : "applied";
}

export async function executeSteps(args: ExecuteStepsArgs): Promise<void> {
  const { steps, variables, outputFolder, rootDir, isDryRun, isOverwrite, record } = args;

  for (const step of steps) {
    const stepVars = resolveStepVariables(step, variables);
    const from = fromOf(step);

    switch (step.type) {
      case "read": {
        if (isDryRun) {
          variables[step.as] = step.as;
          record.steps.push({ name: step.name, type: "read", status: "applied", from });
          break;
        }
        const resolvedPath = resolveTemplateString(step.path, stepVars);
        const targetPath = rootDir.append(`/${resolvedPath}`);
        if (!(await fs.exists(targetPath))) {
          throw use_errors.read_file_not_found(resolvedPath);
        }
        const content = await targetPath.text();
        let value: string;
        if (step.template) {
          value = await runTemplate({
            templatePath: outputFolder.append(`/${step.template}`),
            variables: { ...stepVars, __content: content },
          });
        } else if (step.jsonPath) {
          let json: unknown;
          try {
            json = JSON.parse(content);
          } catch {
            throw use_errors.read_json_parse_error(resolvedPath);
          }
          try {
            value = navigateJsonPath(json, step.jsonPath);
          } catch {
            throw use_errors.read_json_path_not_found(resolvedPath, step.jsonPath);
          }
        } else {
          value = content;
        }
        variables[step.as] = value; // parent scope
        record.steps.push({ name: step.name, type: "read", status: "applied", from });
        break;
      }

      case "create": {
        const outputPath = resolveTemplateString(step.outputPath, stepVars);
        const templatePath = outputFolder.append(`/${step.template}`);
        if (!(await fs.exists(templatePath))) {
          throw use_errors.template_not_found(step.template);
        }
        const rendered = await runTemplate({ templatePath, variables: stepVars });
        record.totalCharacters += rendered.length;

        if (isDryRun) {
          cli.print(`=== ${outputPath} ===\n${rendered}\n\n`);
          record.steps.push({ name: step.name, type: "create", status: "applied", from });
          break;
        }

        const targetPath = rootDir.append(`/${outputPath}`);
        const existed = await fs.exists(targetPath);
        if (existed && !isOverwrite) {
          throw use_errors.destination_file_exists(outputPath);
        }
        await fs.create(targetPath.directory);
        await targetPath.write(rendered);
        record.files.push({ path: outputPath, action: existed ? "modify" : "create" });
        record.steps.push({ name: step.name, type: "create", status: "applied", from });
        cli.print(`Wrote ${outputPath}\n`);
        break;
      }

      case "modify": {
        const outputPath = resolveTemplateString(step.outputPath, stepVars);
        if (isDryRun) {
          const templatePath = outputFolder.append(`/${step.template}`);
          const ext = templatePath.extension;
          const modContent = ext === ".json"
            ? await templatePath.text()
            : await runTemplate({ templatePath, variables: stepVars });
          record.totalCharacters += modContent.length;
          cli.print(`=== ${outputPath} (modify) ===\n${modContent}\n\n`);
          record.steps.push({ name: step.name, type: "modify", status: "applied", from });
          break;
        }

        try {
          const targetPath = rootDir.append(`/${outputPath}`);
          const existed = await fs.exists(targetPath);
          const applied = await applyMultipleModifications({
            task: {
              templatePath: outputFolder.append(`/${step.template}`),
              outputPath,
              variables: stepVars,
            },
            rootDir,
            errors: use_errors,
          });
          record.totalCharacters += applied.content.length;
          await fs.create(targetPath.directory);
          await targetPath.write(applied.content);
          record.files.push({ path: outputPath, action: existed ? "modify" : "create" });
          record.steps.push({ name: step.name, type: "modify", status: "applied", from });
          cli.print(`Modified ${outputPath}\n`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          cli.print(`Warning: skipped modification for ${outputPath} — ${message}\n`);
          record.steps.push({ name: step.name, type: "modify", status: "skipped-warning", from });
        }
        break;
      }

      case "delete": {
        const outputPath = resolveTemplateString(step.outputPath, stepVars);
        if (isDryRun) {
          cli.print(`=== ${outputPath} (delete) ===\nWould delete\n\n`);
          record.steps.push({ name: step.name, type: "delete", status: "applied", from });
          break;
        }
        const targetPath = rootDir.append(`/${outputPath}`);
        const existed = await fs.exists(targetPath);
        if (!existed) {
          cli.print(`Warning: file not found, skipping: ${outputPath}\n`);
          record.steps.push({ name: step.name, type: "delete", status: "skipped-warning", from });
          break;
        }
        await targetPath.remove();
        record.files.push({ path: outputPath, action: "delete" });
        record.steps.push({ name: step.name, type: "delete", status: "applied", from });
        cli.print(`Deleted ${outputPath}\n`);
        break;
      }

      case "install": {
        const status = await handleInstall(step, stepVars, rootDir, isDryRun);
        record.steps.push({ name: step.name, type: "install", status, from });
        break;
      }
    }
  }
}