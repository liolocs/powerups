import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import use_errors from "#errors/useErrors";
import { instructionsSchema } from "#schemas/instruction";
import { extractVariables } from "#utils/variables";
import { resolveOutputPath } from "#utils/output-path";
import { checkOutput } from "#utils/check-output";
import { resolveOutput } from "#utils/resolve";
import { logRun } from "#utils/metrics";
import { runTemplate } from "#template-runners/index";
import {
  applyMultipleModifications,
} from "#utils/modify-engine";
import {
  verifyGitRepo,
  createWorktree,
  removeWorktree,
  copyChangedFiles,
  type ChangedFile,
} from "#utils/worktree";
import { applyDependencies, collectDependencies } from "#utils/dependencies";
import { resolvePowerUp } from "#utils/resolve-powerup";
import {
  CAPITALIZED_SINGLULAR_CLI_NAME,
  MAIN_FOLDER,
  SINGULAR_NAME,
  type PowerUpType,
} from "#constants";

const EXCLUDE_FLAGS = [
  "--dry-run",
  "-d",
  "--overwrite",
  "-O",
  "--help",
  "-h",
  "--type",
  "-t",
];

const use = new Command({
  name: "use",

  description: `Use a ${SINGULAR_NAME}, rendering templates with variables`,

  flags: [
    {
      name: "type",
      long: "type",
      short: "t",
      description: `${CAPITALIZED_SINGLULAR_CLI_NAME} type (multi-use or single-use) for disambiguation`,
    },
    {
      name: "dry-run",
      long: "dry-run",
      short: "d",
      description: "Print output to stdout instead of writing files",
    },
    {
      name: "overwrite",
      long: "overwrite",
      short: "O",
      description: "Overwrite existing destination files for create actions",
    },
  ],

  subcommands: [],

  action: async ({ subcommands, rawFlags, flags, context }) => {
    // 1. Extract name from positional args
    const name = subcommands?.[0];
    if (!is.defined(name)) {
      throw use_errors.missing_name();
    }

    // 2. Locate .<CLI_NAME> folder
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    const hasMainFolder = await fs.exists(mainFolder);

    if (!hasMainFolder) {
      throw use_errors.main_folder_not_found();
    }

    // 3. Resolve powerup via resolvePowerUp (searches both folders)
    const typeFlag = is.defined(flags.type)
      ? (flags.type as PowerUpType)
      : undefined;
    const resolved = await resolvePowerUp(root, name, typeFlag);
    const outputFolder = resolved.folder;
    const typeFolder = resolved.folder.up(1);

    // 4. Validate (checkOutput)
    const issues = await checkOutput({
      rootOutputDir: typeFolder,
      currentOutputDir: outputFolder,
    });

    if (issues.length > 0) {
      throw use_errors.invalid_composition(issues);
    }

    // 5. Load & parse instructions (safe — validated)
    const outputPath = outputFolder.append("/instructions.json");
    const instructions = instructionsSchema.parse(await outputPath.json());

    // 6. Extract & validate variables
    const variables = extractVariables({
      rawFlags: rawFlags ?? [],
      required: instructions.variables.required,
      optional: instructions.variables.optional ?? [],
      excludeFlags: EXCLUDE_FLAGS,
      onMissing: (missing) => {
        throw use_errors.missing_variables(missing, instructions.variables.required, name);
      },
    });

    // 7. Detect --dry-run and --overwrite via rawFlags
    const isDryRun = (rawFlags ?? []).some(
      rawFlag => rawFlag.flag === "--dry-run" || rawFlag.flag === "-d",
    );
    const isOverwrite = (rawFlags ?? []).some(
      f => f.flag === "--overwrite" || f.flag === "-O",
    );

    // 8. Resolve output tree → flat list of render tasks
    const tasks = await resolveOutput({
      outputName: name,
      variables,
      outputsFolder: typeFolder,
    });

    // 9. If --dry-run: render to stdout, no file writes
    if (is.truthy(isDryRun)) {
      let totalCharacters = 0;

      for (const task of tasks) {
        if (task.kind === "delete") {
          const resolvedPath = resolveOutputPath(task.outputPath, task.variables);

          cli.print(`=== ${resolvedPath} (delete) ===\n`);
          cli.print("Would delete\n");
          cli.print("\n");

          continue;
        }

        if (!(await fs.exists(task.templatePath!))) {
          throw use_errors.template_not_found(task.templatePath!.name);
        }

        if (task.kind === "create") {
          const rendered = await runTemplate({
            templatePath: task.templatePath!,
            variables: task.variables,
          });

          totalCharacters += rendered.length;

          const resolvedPath = resolveOutputPath(task.outputPath, task.variables);

          cli.print(`=== ${resolvedPath} ===\n`);
          cli.print(rendered);
          cli.print("\n");
        } else {
          // Modify: show what would change
          const resolvedPath = resolveOutputPath(task.outputPath, task.variables);

          cli.print(`=== ${resolvedPath} (modify) ===\n`);
          // Render the modify template to preview modifications
          const ext = task.templatePath!.extension;

          let modContent: string;

          if (ext === ".json") {
            modContent = await task.templatePath!.text();
          } else {
            modContent = await runTemplate({
              templatePath: task.templatePath!,
              variables: task.variables,
            });
          }
          cli.print(modContent);
          cli.print("\n");
        }
      }
      // Process packageDependencies in dry-run mode
      if (instructions.packageDependencies || instructions.includes) {
        const collectedDeps = await collectDependencies({ outputName: name, outputsFolder: typeFolder });

        if (collectedDeps.length > 0) {
          await applyDependencies({
            projectRoot: root,
            packageDependencies: collectedDeps,
            isDryRun: true,
          });
        }
      }

      return;
    }

    // 10. Non-dry-run: use git worktree
    try {
      await verifyGitRepo(root);
    } catch {
      throw use_errors.git_repo_required();
    }

    const worktree = await createWorktree(root);
    const changedFiles: ChangedFile[] = [];

    let totalCharacters = 0;

    try {
      for (const task of tasks) {
        const resolvedPath = resolveOutputPath(task.outputPath, task.variables);

        if (task.kind === "delete") {
          const targetPath = worktree.root.append(`/${resolvedPath}`);
          const exists = await fs.exists(targetPath);

          if (!exists) {
            cli.print(`Warning: file not found, skipping: ${resolvedPath}\n`);
            continue;
          }

          await targetPath.remove();

          changedFiles.push({
            worktreePath: targetPath.path,
            projectPath: resolvedPath,
            deleted: true,
          });

          cli.print(`Deleted ${resolvedPath}\n`);

          continue;
        }

        if (!(await fs.exists(task.templatePath!))) {
          throw use_errors.template_not_found(task.templatePath!.name);
        }

        if (task.kind === "create") {
          const rendered = await runTemplate({
            templatePath: task.templatePath!,
            variables: task.variables,
          });

          totalCharacters += rendered.length;

          const targetPath = worktree.root.append(`/${resolvedPath}`);
          const targetExists = await fs.exists(targetPath);

          if (targetExists && !isOverwrite) {
            throw use_errors.destination_file_exists(resolvedPath);
          }

          await fs.create(targetPath.directory);
          await targetPath.write(rendered);

          changedFiles.push({
            worktreePath: targetPath.path,
            projectPath: resolvedPath,
          });

          cli.print(`Wrote ${resolvedPath}\n`);
        } else {
          try {
            const applied = await applyMultipleModifications({
              task: {
                templatePath: task.templatePath!,
                outputPath: resolvedPath,
                variables: task.variables,
              },
              rootDir: worktree.root,
              errors: use_errors,
            });

            totalCharacters += applied.content.length;

            const targetPath = worktree.root.append(`/${resolvedPath}`);

            await fs.create(targetPath.directory);
            await targetPath.write(applied.content);

            changedFiles.push({
              worktreePath: targetPath.path,
              projectPath: resolvedPath,
            });

            cli.print(`Modified ${resolvedPath}\n`);
          } catch (error) {
            // Warn and continue — don't abort the whole use
            const message = error instanceof Error ? error.message : String(error);
            cli.print(`Warning: skipped modification for ${resolvedPath} — ${message}\n`);
          }
        }
      }
    } catch (error) {
      await removeWorktree(root, worktree.path);
      throw error;
    }

    // 11. Copy changed files back and clean up
    await copyChangedFiles(root, changedFiles);
    await removeWorktree(root, worktree.path);

    // 11.5 Process packageDependencies
    if (instructions.packageDependencies || instructions.includes) {
      try {
        const collectedDeps = await collectDependencies({ outputName: name, outputsFolder: typeFolder });

        if (collectedDeps.length > 0) {
          await applyDependencies({
            projectRoot: root,
            packageDependencies: collectedDeps,
            isDryRun: false,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        cli.print(`Warning: dependency installation failed — ${message}\n`);
      }
    }

    // 12. Log metrics (best-effort)
    try {
      await logRun({ output: name, characters: totalCharacters }, root);
    } catch {
      // Metrics are secondary — never crash a successful run
    }
  },
});

export default use;