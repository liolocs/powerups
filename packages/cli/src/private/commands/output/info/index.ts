import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import output_info_errors from "#errors/outputInfoErrors";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import { toKebabCase } from "#utils/variables";
import {
  CLI_NAME,
  MAIN_FOLDER,
  OUTPUT_FOLDER,
  domainFolderMap,
} from "#constants";

interface CollectedFile {
  kind: "create" | "modify" | "delete";
  template?: string;
  outputPath: string;
  fromInclude: string | null;
}

interface IncludeSummary {
  name: string;
  description: string;
  bindings: { key: string; value: string; isReference: boolean }[];
}

interface CollectedInfo {
  files: CollectedFile[];
  dependencies: NonNullable<Instructions["packageDependencies"]>;
  includes: IncludeSummary[];
}

async function collectInfo(args: {
  outputName: string;
  outputsFolder: FileRef;
  pathStack: string[];
  createOverrides?: Record<string, string>;
  modifyOverrides?: Record<string, string>;
  deleteOverrides?: Record<string, string>;
  fromInclude?: string | null;
}): Promise<CollectedInfo> {
  const { outputName, outputsFolder, pathStack } = args;
  const createOverrides = args.createOverrides ?? {};
  const modifyOverrides = args.modifyOverrides ?? {};
  const deleteOverrides = args.deleteOverrides ?? {};
  const fromInclude = args.fromInclude ?? null;

  const outputFolder = outputsFolder.append(`/${outputName}`);
  const outputPath = outputFolder.append("/instructions.json");
  const instructions = instructionsSchema.parse(await outputPath.json());

  const files: CollectedFile[] = [];
  const dependencies: NonNullable<Instructions["packageDependencies"]> = [];
  const includes: IncludeSummary[] = [];

  // Own create files
  for (const file of instructions.output.create) {
    let fileOutputPath = file.outputPath;
    if (is.defined(createOverrides[file.name])) {
      fileOutputPath = createOverrides[file.name];
    }
    files.push({
      kind: "create",
      template: file.template,
      outputPath: fileOutputPath,
      fromInclude,
    });
  }

  // Own modify files
  for (const file of instructions.output.modify) {
    let fileOutputPath = file.outputPath;
    if (is.defined(modifyOverrides[file.name])) {
      fileOutputPath = modifyOverrides[file.name];
    }
    files.push({
      kind: "modify",
      template: file.template,
      outputPath: fileOutputPath,
      fromInclude,
    });
  }

  // Own delete files
  for (const file of instructions.output.delete ?? []) {
    let fileOutputPath = file.outputPath;
    if (is.defined(deleteOverrides[file.name])) {
      fileOutputPath = deleteOverrides[file.name];
    }
    files.push({
      kind: "delete",
      outputPath: fileOutputPath,
      fromInclude,
    });
  }

  // Own packageDependencies
  if (is.defined(instructions.packageDependencies)) {
    dependencies.push(...instructions.packageDependencies);
  }

  // Includes
  if (is.defined(instructions.includes)) {
    for (const ref of instructions.includes) {
      // Cycle guard
      if (pathStack.includes(ref.name)) {
        continue;
      }

      // Build include summary
      const suboutputDir = outputsFolder.append(`/${ref.name}`);
      const subOutputPath = suboutputDir.append("/instructions.json");
      let subDescription = "";
      try {
        const subInstructions = instructionsSchema.parse(await subOutputPath.json());
        subDescription = subInstructions.description;
      } catch {
        // If we can't read it, just use empty description
      }

      const bindings = Object.entries(ref.variables).map(([key, value]) => ({
        key,
        value,
        isReference: /\{\{(\w+)\}\}/.test(value),
      }));

      includes.push({
        name: ref.name,
        description: subDescription,
        bindings,
      });

      // Recurse into child
      const childCreateOverrides = ref.outputPathOverride?.create ?? {};
      const childModifyOverrides = ref.outputPathOverride?.modify ?? {};
      const childDeleteOverrides = ref.outputPathOverride?.delete ?? {};

      const childInfo = await collectInfo({
        outputName: ref.name,
        outputsFolder,
        pathStack: [...pathStack, ref.name],
        createOverrides: childCreateOverrides,
        modifyOverrides: childModifyOverrides,
        deleteOverrides: childDeleteOverrides,
        fromInclude: ref.name,
      });

      files.push(...childInfo.files);
      dependencies.push(...childInfo.dependencies);
      includes.push(...childInfo.includes);
    }
  }

  return { files, dependencies, includes };
}

export default function createInfoCommand(
  domain: "template" | "feature",
): Command<any> {
  const errors = output_info_errors[domain];

  return new Command({
    name: "info",
    description: `Show how to use a ${domain}`,
    flags: [],
    subcommands: [],
    action: async (props) => {
      const name = props?.subcommands?.[0];

      if (!is.defined(name)) {
        throw errors.missing_name();
      }

      const root: FileRef = props?.context?.root ?? await runtime.projectRoot();
      const mainFolder = root.append(`/${MAIN_FOLDER}`);
      if (!(await fs.exists(mainFolder))) {
        throw errors.dry_folder_not_found();
      }

      const domainFolder = mainFolder.append(
        `/${OUTPUT_FOLDER}/${domainFolderMap[domain]}`,
      );
      const outputFolder = domainFolder.append(`/${name}`);
      if (!(await fs.exists(outputFolder))) {
        throw errors.not_found(name);
      }

      const outputPath = outputFolder.append("/instructions.json");
      const instructions = instructionsSchema.parse(await outputPath.json());

      const collected = await collectInfo({
        outputName: name,
        outputsFolder: domainFolder,
        pathStack: [name],
      });

      const lines: string[] = [];

      lines.push(`# ${instructions.name}`);
      lines.push("");
      lines.push(instructions.description);
      lines.push("");

      if (instructions.intent.length > 0) {
        lines.push("## Intent");
        lines.push("");
        lines.push(instructions.intent.join(", "));
        lines.push("");
      }

      const hasRequired = instructions.variables.required.length > 0;
      const hasOptional = (instructions.variables.optional ?? []).length > 0;
      if (hasRequired || hasOptional) {
        lines.push("## Variables");
        lines.push("");
        if (hasRequired) {
          lines.push("### Required");
          lines.push("");
          for (const v of instructions.variables.required) {
            lines.push(`- \`--${toKebabCase(v)}=<value>\``);
          }
          lines.push("");
        }
        if (hasOptional) {
          lines.push("### Optional");
          lines.push("");
          for (const v of instructions.variables.optional!) {
            lines.push(`- \`--${toKebabCase(v)}=<value>\``);
          }
          lines.push("");
        }
      }

      const createFiles = collected.files.filter(f => f.kind === "create");
      const modifyFiles = collected.files.filter(f => f.kind === "modify");
      const deleteFiles = collected.files.filter(f => f.kind === "delete");

      if (createFiles.length > 0 || modifyFiles.length > 0 || deleteFiles.length > 0) {
        lines.push("## Files");
        lines.push("");

        if (createFiles.length > 0) {
          lines.push("### Create");
          lines.push("");

          for (const fileToCreate of createFiles) {
            const meta: string[] = [];

            if (is.truthy(fileToCreate.template)) {
              meta.push(`template: \`${fileToCreate.template}\``);
            }

            if (is.truthy(fileToCreate.fromInclude)) {
              meta.push(`from include: ${fileToCreate.fromInclude}`);
            }

            const metaPart = meta.length > 0 ? ` (${meta.join(", ")})` : "";

            lines.push(`- \`${fileToCreate.outputPath}\`${metaPart}`);
          }
          lines.push("");
        }

        if (modifyFiles.length > 0) {
          lines.push("### Modify");
          lines.push("");
          for (const f of modifyFiles) {
            const meta: string[] = [];
            if (f.template) meta.push(`template: \`${f.template}\``);
            if (f.fromInclude) meta.push(`from include: ${f.fromInclude}`);
            const metaPart = meta.length > 0 ? ` (${meta.join(", ")})` : "";
            lines.push(`- \`${f.outputPath}\`${metaPart}`);
          }
          lines.push("");
        }
        if (deleteFiles.length > 0) {
          lines.push("### Delete");
          lines.push("");
          for (const f of deleteFiles) {
            const includePart = f.fromInclude ? ` (from include: ${f.fromInclude})` : "";
            lines.push(`- \`${f.outputPath}\`${includePart}`);
          }
          lines.push("");
        }
      }

      // Dependencies
      if (collected.dependencies.length > 0) {
        lines.push("## Dependencies");
        lines.push("");
        for (const dep of collected.dependencies) {
          if (is.defined(dep.dependencies)) {
            for (const d of dep.dependencies) {
              const targetPart = dep.target ? ` (target: ${dep.target})` : "";
              lines.push(`- ${d}${targetPart}`);
            }
          }
          if (is.defined(dep.devDependencies)) {
            for (const d of dep.devDependencies) {
              const targetPart = dep.target ? `, target: ${dep.target}` : "";
              lines.push(`- ${d} (devDependency${targetPart})`);
            }
          }
          if (is.defined(dep.peerDependencies)) {
            for (const d of dep.peerDependencies) {
              const targetPart = dep.target ? `, target: ${dep.target}` : "";
              lines.push(`- ${d} (peerDependency${targetPart})`);
            }
          }
        }
        lines.push("");
      }

      // Includes
      if (collected.includes.length > 0) {
        lines.push("## Includes");
        lines.push("");
        for (const inc of collected.includes) {
          lines.push(`- **${inc.name}** — ${inc.description}`);
          const bindings = inc.bindings.map(b =>
            `${b.key} = "${b.value}" (${b.isReference ? "from parent" : "literal"})`
          ).join(", ");
          lines.push(`  - Variable bindings: ${bindings}`);
          lines.push("");
        }
      }

      // Usage
      lines.push("## Usage");
      lines.push("");
      lines.push("```");
      const requiredFlags = instructions.variables.required
        .map(v => `--${toKebabCase(v)}=<value>`)
        .join(" ");
      const optionalFlags = (instructions.variables.optional ?? [])
        .map(v => `[--${toKebabCase(v)}=<value>]`)
        .join(" ");
      let cmd = `${CLI_NAME} ${domain} apply ${instructions.name}`;
      if (requiredFlags) cmd += ` ${requiredFlags}`;
      if (optionalFlags) cmd += ` ${optionalFlags}`;
      lines.push(cmd);
      lines.push("```");

      cli.print(`${lines.join("\n")}\n`);
    },
  });
}