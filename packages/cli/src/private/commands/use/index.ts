import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import use_errors from "#errors/useErrors";
import { instructionsSchema } from "#schemas/instruction";
import { extractVariables } from "#utils/variables";
import { checkOutput } from "#utils/check-output";
import { executeSteps } from "#utils/execute-steps";
import { logRun } from "#utils/metrics";
import {
  verifyGitRepo,
  createWorktree,
  removeWorktree,
  copyChangedFiles,
  type ChangedFile,
} from "#utils/worktree";
import { applyDependencies, collectDependencies } from "#utils/dependencies";
import { resolvePowerUp } from "#utils/resolve-powerup";
import { recordApplication } from "#utils/applied-manifest";
import {
  CAPITALIZED_SINGLULAR_CLI_NAME,
  MAIN_FOLDER,
  PACKAGE_FILE,
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

    // 8. Dry-run: execute steps printing to stdout
    if (is.truthy(isDryRun)) {
      await executeSteps({
        steps: instructions.steps,
        variables,
        outputFolder,
        rootDir: root,
        worktreeRoot: undefined,
        outputsFolder: typeFolder,
        isDryRun: true,
        isOverwrite,
        changedFiles: [],
      });

      // Process packageDependencies in dry-run mode
      if (instructions.packageDependencies || instructions.steps.some(s => s.type === "include")) {
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

    // 9. Non-dry-run: use git worktree
    try {
      await verifyGitRepo(root);
    } catch {
      throw use_errors.git_repo_required();
    }

    const worktree = await createWorktree(root);
    const changedFiles: ChangedFile[] = [];

    let totalCharacters = 0;

    try {
      totalCharacters = await executeSteps({
        steps: instructions.steps,
        variables,
        outputFolder,
        rootDir: root,
        worktreeRoot: worktree.root,
        outputsFolder: typeFolder,
        isDryRun: false,
        isOverwrite,
        changedFiles,
      });
    } catch (error) {
      await removeWorktree(root, worktree.path);
      throw error;
    }

    // 10. Classify changed files (before copy makes everything exist)
    const classifiedFiles = await Promise.all(changedFiles.map(async file => ({
      path: file.projectPath,
      action: (file.deleted === true
        ? "delete"
        : await fs.exists(root.append(`/${file.projectPath}`))
          ? "modify"
          : "create") as "create" | "modify" | "delete",
    })));

    // 11. Copy changed files back and clean up
    await copyChangedFiles(root, changedFiles);
    await removeWorktree(root, worktree.path);

    // 12. Process packageDependencies
    if (instructions.packageDependencies || instructions.steps.some(s => s.type === "include")) {
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

    // 13. Record the application in the applied manifest (best-effort)
    try {
      const packJsonRef = outputFolder.up(2).append(`/${PACKAGE_FILE}`);
      const packJson = await packJsonRef.json() as { version?: string };
      await recordApplication({
        root,
        powerup: resolved.packageName,
        name,
        version: packJson.version ?? "0.0.0",
        location: resolved.location,
        variables,
        changedFiles: classifiedFiles,
        singleUse: resolved.type === "single-use",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      cli.print(`Warning: could not record applied manifest entry — ${message}\n`);
    }

    // 14. Log metrics (best-effort)
    try {
      await logRun(
        { output: name, characters: totalCharacters },
        { cwd: root.path, globalRoot: context?.globalRoot },
      );
    } catch {
      // Metrics are secondary — never crash a successful run
    }
  },
});

export default use;