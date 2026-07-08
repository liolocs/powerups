import { Command } from "@saved/program";
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { checkOutput } from "#utils/check-output";
import { modificationArraySchema } from "#schemas/modification";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import doctorErrors from "#errors/doctorErrors";
import {
  CLI_NAME,
  MAIN_FOLDER,
  OUTPUT_FOLDER,
  TEMPLATE_FOLDER,
  FEATURE_FOLDER,
} from "#constants";

const execAsync = promisify(exec);

interface DoctorIssue {
  level: "WARN" | "ERROR";
  domain: string;
  name: string;
  message: string;
}

const doctor = new Command({
  name: "doctor",
  description: `Health check for ${CLI_NAME} templates and features`,
  flags: [],
  subcommands: [],
  action: async ({ context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();
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
            domain: "git",
            name: "status",
            message: "Working tree is not clean",
          });
        }
      } catch {
        issues.push({
          level: "WARN",
          domain: "git",
          name: "status",
          message: "Could not check git status",
        });
      }
    } catch {
      gitOk = false;
      issues.push({
        level: "ERROR",
        domain: "git",
        name: "repo",
        message: "Not a git repository",
      });
    }

    // 2. Folder structure
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    if (!(await fs.exists(mainFolder))) {
      throw doctorErrors.not_initialized();
    }

    const outputFolder = mainFolder.append(`/${OUTPUT_FOLDER}`);
    let templateCount = 0;
    let featureCount = 0;

    for (const [domain, folder] of [
      ["template", TEMPLATE_FOLDER],
      ["feature", FEATURE_FOLDER],
    ] as const) {
      const domainFolder = outputFolder.append(`/${folder}`);
      if (!(await fs.exists(domainFolder))) {
        issues.push({
          level: "WARN",
          domain,
          name: "structure",
          message: `No ${domain} folder found`,
        });
        continue;
      }

      // 3. Per-domain validation
      const outputFiles = await domainFolder.files({
        recursive: true,
        filter: (file) => file.name === "instructions.json",
      });

      if (domain === "template") templateCount = outputFiles.length;
      else featureCount = outputFiles.length;

      for (const outputFile of outputFiles) {
        const name = outputFile.directory.name;

        // Run standard checks (schema, templates, suboutput tree)
        const checkIssues = await checkOutput({
          rootOutputDir: domainFolder,
          currentOutputDir: outputFile.directory,
        });
        for (const issue of checkIssues) {
          issues.push({ level: "ERROR", domain, name, message: issue });
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

          // List all files in the output directory (non-recursive top level)
          const allFiles = await outputFile.directory.files();
          for (const file of allFiles) {
            if (!referencedFiles.has(file.name)) {
              issues.push({
                level: "WARN",
                domain,
                name,
                message: `Orphaned file: ${file.name}`,
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
                domain,
                name,
                message: `Invalid modify template: ${modifyEntry.template} (${parseErr instanceof Error ? parseErr.message : "parse error"})`,
              });
            }
          }
        } catch {
          // Already captured by checkIssues
        }
      }
    }

    // 4. Print results
    const errorCount = issues.filter(i => i.level === "ERROR").length;
    const warnCount = issues.filter(i => i.level === "WARN").length;

    cli.print(
      `Doctor: checking git state, folder structure, ${templateCount} template(s), ${featureCount} feature(s)`,
    );
    cli.print("");

    for (const issue of issues) {
      const prefix = issue.level === "ERROR" ? "ERROR" : "WARN";
      cli.print(`  [${prefix}] [${issue.domain}:${issue.name}] ${issue.message}`);
    }

    if (errorCount === 0 && warnCount === 0) {
      cli.print("All checks passed.");
    } else {
      cli.print(`\n${errorCount} error(s), ${warnCount} warning(s)`);
    }

    if (errorCount > 0) {
      throw doctorErrors.validation_failed(errorCount);
    }
  },
});

export default doctor;