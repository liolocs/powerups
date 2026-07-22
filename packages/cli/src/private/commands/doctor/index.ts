import { Command } from "@powerups/program";
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { checkOutput } from "#utils/check-output";
import { readConfig } from "#utils/config";
import { modificationArraySchema } from "#schemas/modification";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import doctorErrors from "#errors/doctorErrors";
import {
  CLI_NAME,
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  GLOBAL_INTERNAL_PATH,
  SINGULAR_NAME,
} from "#constants";

const execAsync = promisify(exec);

interface DoctorIssue {
  level: "WARN" | "ERROR";
  type: string;
  name: string;
  message: string;
}

const doctor = new Command({
  name: "doctor",
  description: `Health check for ${CLI_NAME}`,
  flags: [],
  subcommands: [],
  action: async (props) => {
    const root: FileRef = props?.context?.root ?? await runtime.projectRoot();
    const issues: DoctorIssue[] = [];

    // 1. Git repo state
    let gitOk = true;
    try {
      await execAsync("git rev-parse --git-dir", { cwd: root.path });
      // Check working tree clean
      try {
        const { stdout } = await execAsync("git status --porcelain", {
          cwd: root.path,
        });
        if (stdout.trim().length > 0) {
          issues.push({
            level: "WARN",
            type: "git",
            name: "status",
            message: "Working tree is not clean",
          });
        }
      } catch {
        issues.push({
          level: "WARN",
          type: "git",
          name: "status",
          message: "Could not check git status",
        });
      }
    } catch {
      gitOk = false;
      issues.push({
        level: "ERROR",
        type: "git",
        name: "repo",
        message: "Not a git repository",
      });
    }

    // 2. Folder structure
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    if (!(await fs.exists(mainFolder))) {
      throw doctorErrors.not_initialized();
    }

    const internalFolder = mainFolder.append(`/${INTERNAL_FOLDER}`);
    let multiUseCount = 0;
    let singleUseCount = 0;

    if (!(await fs.exists(internalFolder))) {
      issues.push({
        level: "WARN",
        type: "structure",
        name: "internal",
        message: `No ${INTERNAL_FOLDER} folder found`,
      });
    } else {
      // Scan each package
      const packageDirs = await internalFolder.dirs();
      for (const packageDir of packageDirs) {
        const pkgJsonPath = packageDir.append(`/${PACKAGE_FILE}`);
        if (!(await fs.exists(pkgJsonPath))) {
          issues.push({
            level: "WARN",
            type: "package",
            name: packageDir.name,
            message: "Missing package.json",
          });
          continue;
        }

        // Validate package.json is parseable
        try {
          await pkgJsonPath.json();
        } catch {
          issues.push({
            level: "ERROR",
            type: "package",
            name: packageDir.name,
            message: "Invalid package.json",
          });
          continue;
        }

        const activeFolder = packageDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
        for (const [type, folder] of [
          ["multi-use", MULTI_USE_FOLDER],
          ["single-use", SINGLE_USE_FOLDER],
        ] as const) {
          const typeFolder = activeFolder.append(`/${folder}`);
          if (!(await fs.exists(typeFolder))) continue;

          const outputFiles = await typeFolder.files({
            recursive: true,
            filter: (file) => file.name === "instructions.json",
          });

          if (type === "multi-use") multiUseCount += outputFiles.length;
          else singleUseCount += outputFiles.length;

          for (const outputFile of outputFiles) {
            const powerupsName = outputFile.directory.name;
            const label = `${packageDir.name}:${powerupsName}`;

            // Run standard checks (schema, templates, suboutput tree)
            const checkIssues = await checkOutput({
              rootOutputDir: typeFolder,
              currentOutputDir: outputFile.directory,
            });
            for (const issue of checkIssues) {
              issues.push({ level: "ERROR", type, name: label, message: issue });
            }

            // Additional: orphaned files check
            try {
              const instructions: Instructions = instructionsSchema.parse(
                await outputFile.json(),
              );
              const referencedFiles = new Set<string>();
              referencedFiles.add("instructions.json");
              for (const f of instructions.output.create) {
                referencedFiles.add(f.template);
              }
              for (const f of instructions.output.modify) {
                referencedFiles.add(f.template);
              }

              const allFiles = await outputFile.directory.files({
                recursive: true,
              });
              for (const file of allFiles) {
                const relPath = path.relative(
                  outputFile.directory.path,
                  file.path,
                );
                if (!referencedFiles.has(relPath)) {
                  issues.push({
                    level: "WARN",
                    type,
                    name: label,
                    message: `Orphaned file: ${relPath}`,
                  });
                }
              }
            } catch {
              // If we can't parse, the checkIssues already captured it
            }

            // Additional: modify template parseability (.json only)
            try {
              const instructions: Instructions = instructionsSchema.parse(
                await outputFile.json(),
              );
              for (const modifyEntry of instructions.output.modify) {
                const modTemplatePath = outputFile.directory.append(
                  `/${modifyEntry.template}`,
                );
                if (!(await fs.exists(modTemplatePath))) continue;
                const ext = modTemplatePath.extension;
                if (ext !== ".json") continue;

                try {
                  const content = await modTemplatePath.text();
                  const parsed = JSON.parse(content);
                  modificationArraySchema.parse(parsed);
                } catch (parseErr) {
                  issues.push({
                    level: "ERROR",
                    type,
                    name: label,
                    message: `Invalid modify template: ${modifyEntry.template} (${parseErr instanceof Error ? parseErr.message : "parse error"})`,
                  });
                }
              }
            } catch {
              // Already captured by checkIssues
            }
          }
        }
      }
    }

    // 3.5 Config packages validation — verify each config-listed package resolves
    const config = await readConfig(root);
    if (config !== null) {
      for (const packageName of config.packages) {
        const localDir = root.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${packageName}`);
        const globalDir = fs.ref(`${GLOBAL_INTERNAL_PATH}/${packageName}`);
        if (!(await fs.exists(localDir)) && !(await fs.exists(globalDir))) {
          issues.push({
            level: "WARN",
            type: "config",
            name: packageName,
            message: `Package "${packageName}" listed in config but not found on disk (local or global)`,
          });
        }
      }
    }

    // 4. Print results
    const errorCount = issues.filter(i => i.level === "ERROR").length;
    const warnCount = issues.filter(i => i.level === "WARN").length;

    cli.print(
      `Doctor: checking git state, folder structure, ${multiUseCount} multi-use ${SINGULAR_NAME}(s), ${singleUseCount} single-use ${SINGULAR_NAME}(s)\n`,
    );
    cli.print("\n");

    for (const issue of issues) {
      const prefix = issue.level === "ERROR" ? "ERROR" : "WARN";
      cli.print(`  [${prefix}] [${issue.type}:${issue.name}] ${issue.message}\n`);
    }

    if (errorCount === 0 && warnCount === 0) {
      cli.print("All checks passed.\n");
    } else {
      cli.print(`\n${errorCount} error(s), ${warnCount} warning(s)\n`);
    }

    if (errorCount > 0) {
      throw doctorErrors.validation_failed(errorCount);
    }
  },
});

export default doctor;