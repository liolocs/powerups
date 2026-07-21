import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powers/program";
import info_errors from "#errors/infoErrors";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import { toKebabCase } from "#utils/variables";
import { resolvePower } from "#utils/resolve-power";
import {
  CLI_CMD,
  MAIN_FOLDER,
  type PowerType,
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

const info = new Command({
  name: "info",
  description: "Show how to use a power",
  flags: [
    {
      name: "type",
      long: "type",
      short: "t",
      description: "Power type (multi-use or single-use) for disambiguation",
    },
  ],
  subcommands: [],
  action: async (props) => {
    const name = props.subcommands?.[0];

    if (!is.defined(name)) {
      throw info_errors.missing_name();
    }

    const root: FileRef = props.context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    if (!(await fs.exists(mainFolder))) {
      throw info_errors.dry_folder_not_found();
    }

    // Resolve power via resolvePower (searches both folders)
    const typeFlag = is.defined(props.flags.type)
      ? (props.flags.type as PowerType)
      : undefined;
    const resolved = await resolvePower(root, name, typeFlag);
    const outputFolder = resolved.folder;
    const typeFolder = resolved.folder.up(1);

    const outputPath = outputFolder.append("/instructions.json");
    const instructions = instructionsSchema.parse(await outputPath.json());

    const collected = await collectInfo({
      outputName: name,
      outputsFolder: typeFolder,
      pathStack: [name],
    });

    const lines: string[] = [];

    lines.push(`# ${instructions.name} (${resolved.type})`);
    lines.push(`   package: ${resolved.packageName} (${resolved.location})`);
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

    const fileSections = [
      {
        title: "Create",
        files: collected.files.filter(file => file.kind === "create"),
      },
      {
        title: "Modify",
        files: collected.files.filter(file => file.kind === "modify"),
      },
      {
        title: "Delete",
        files: collected.files.filter(file => file.kind === "delete"),
      },
    ];

    if (fileSections.some(section => section.files.length > 0)) {
      lines.push("## Files");
      lines.push("");

      for (const section of fileSections) {
        if (section.files.length === 0) {
          continue;
        }

        lines.push(`### ${section.title}`);
        lines.push("");

        for (const file of section.files) {
          const meta: string[] = [];

          if (is.truthy(file.template)) {
            meta.push(`template: \`${file.template}\``);
          }

          if (is.truthy(file.fromInclude)) {
            meta.push(`from include: ${file.fromInclude}`);
          }

          const metaPart = meta.length > 0 ? ` (${meta.join(", ")})` : "";

          lines.push(`- \`${file.outputPath}\`${metaPart}`);
        }

        lines.push("");
      }
    }

    if (collected.dependencies.length > 0) {
      lines.push("## Dependencies");
      lines.push("");

      for (const dep of collected.dependencies) {
        const dependencyGroups = [
          { label: null, packages: dep.dependencies },
          { label: "devDependency", packages: dep.devDependencies },
          { label: "peerDependency", packages: dep.peerDependencies },
        ];

        for (const group of dependencyGroups) {
          if (!is.defined(group.packages)) {
            continue;
          }

          for (const pkg of group.packages) {
            if (group.label === null) {
              const targetPart = is.truthy(dep.target)
                ? ` (target: ${dep.target})`
                : "";

              lines.push(`- ${pkg}${targetPart}`);
            } else {
              const targetPart = is.truthy(dep.target)
                ? `, target: ${dep.target}`
                : "";

              lines.push(`- ${pkg} (${group.label}${targetPart})`);
            }
          }
        }

        lines.push("");
      }
    }

    if (collected.includes.length > 0) {
      lines.push("## Includes");
      lines.push("");

      for (const include of collected.includes) {
        lines.push(`- **${include.name}** — ${include.description}`);

        const bindings = include.bindings
          .map(binding =>
            `${binding.key} = "${binding.value}" (${binding.isReference ? "from parent" : "literal"})`
          )
          .join(", ");

        lines.push(`  - Variable bindings: ${bindings}`);
        lines.push("");
      }
    }

    lines.push("## Usage");
    lines.push("");
    lines.push("```");

    const requiredFlags = instructions.variables.required
      .map(variable => `--${toKebabCase(variable)}=<value>`)
      .join(" ");

    const optionalFlags = (instructions.variables.optional ?? [])
      .map(variable => `[--${toKebabCase(variable)}=<value>]`)
      .join(" ");

    let command = `${CLI_CMD} use ${instructions.name}`;

    if (is.truthy(requiredFlags)) {
      command += ` ${requiredFlags}`;
    }

    if (is.truthy(optionalFlags)) {
      command += ` ${optionalFlags}`;
    }

    lines.push(command);
    lines.push("```");

    cli.print(`${lines.join("\n")}\n`);
  },
});

export default info;