import { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import info_errors from "#errors/infoErrors";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import { toKebabCase } from "#utils/variables";
import { resolvePowerUp } from "#utils/resolve-powerup";
import {
  CAPITALIZED_SINGLULAR_CLI_NAME,
  CLI_CMD,
  SINGULAR_NAME,
  type PowerUpType,
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

interface ReadSummary {
  name: string;
  path: string;
  as: string;
  mode: string;
}

interface CollectedInfo {
  files: CollectedFile[];
  reads: ReadSummary[];
  dependencies: NonNullable<Instructions["packageDependencies"]>;
  includes: IncludeSummary[];
}

async function collectInfo(args: {
  outputName: string;
  outputsFolder: FileRef;
  pathStack: string[];
  stepOverrides?: Record<string, string>;
  excludeSteps?: Set<string>;
  fromInclude?: string | null;
}): Promise<CollectedInfo> {
  const { outputName, outputsFolder, pathStack } = args;
  const stepOverrides = args.stepOverrides ?? {};
  const excludeSteps = args.excludeSteps ?? new Set<string>();
  const fromInclude = args.fromInclude ?? null;

  const outputFolder = outputsFolder.append(`/${outputName}`);
  const outputPath = outputFolder.append("/instructions.json");
  const instructions = instructionsSchema.parse(await outputPath.json());

  const files: CollectedFile[] = [];
  const reads: ReadSummary[] = [];
  const dependencies: NonNullable<Instructions["packageDependencies"]> = [];
  const includes: IncludeSummary[] = [];

  for (const step of instructions.steps) {
    if (excludeSteps.has(step.name)) continue;

    if (step.type === "create") {
      let fileOutputPath = step.outputPath;
      if (is.defined(stepOverrides[step.name])) {
        fileOutputPath = stepOverrides[step.name];
      }
      files.push({
        kind: "create",
        template: step.template,
        outputPath: fileOutputPath,
        fromInclude,
      });
    } else if (step.type === "modify") {
      let fileOutputPath = step.outputPath;
      if (is.defined(stepOverrides[step.name])) {
        fileOutputPath = stepOverrides[step.name];
      }
      files.push({
        kind: "modify",
        template: step.template,
        outputPath: fileOutputPath,
        fromInclude,
      });
    } else if (step.type === "delete") {
      let fileOutputPath = step.outputPath;
      if (is.defined(stepOverrides[step.name])) {
        fileOutputPath = stepOverrides[step.name];
      }
      files.push({
        kind: "delete",
        outputPath: fileOutputPath,
        fromInclude,
      });
    } else if (step.type === "read") {
      const mode = step.template ? "template" : step.jsonPath ? "jsonPath" : "raw";
      reads.push({
        name: step.name,
        path: step.path,
        as: step.as,
        mode,
      });
    } else if (step.type === "include") {
      if (pathStack.includes(step.name)) {
        continue;
      }

      const suboutputDir = outputsFolder.append(`/${step.name}`);
      const subOutputPath = suboutputDir.append("/instructions.json");
      let subDescription = "";
      try {
        const subInstructions = instructionsSchema.parse(await subOutputPath.json());
        subDescription = subInstructions.description;
      } catch {
        // If we can't read it, just use empty description
      }

      const bindings = Object.entries(step.variables).map(([key, value]) => ({
        key,
        value,
        isReference: /\{\{(\w+)\}\}/.test(value),
      }));

      includes.push({
        name: step.name,
        description: subDescription,
        bindings,
      });

      // Build child step overrides (extract outputPath from override values)
      const childStepOverrides: Record<string, string> = {};
      if (step.stepOverride) {
        for (const [name, override] of Object.entries(step.stepOverride)) {
          if ("outputPath" in override) {
            childStepOverrides[name] = override.outputPath;
          }
        }
      }

      const childExcludeSteps = new Set(step.excludeSteps ?? []);

      const childInfo = await collectInfo({
        outputName: step.name,
        outputsFolder,
        pathStack: [...pathStack, step.name],
        stepOverrides: childStepOverrides,
        excludeSteps: childExcludeSteps,
        fromInclude: step.name,
      });

      files.push(...childInfo.files);
      reads.push(...childInfo.reads);
      dependencies.push(...childInfo.dependencies);
      includes.push(...childInfo.includes);
    }
  }

  // Own packageDependencies
  if (is.defined(instructions.packageDependencies)) {
    dependencies.push(...instructions.packageDependencies);
  }

  return { files, reads, dependencies, includes };
}

const info = new Command({
  name: "info",
  description: `Show how to use a ${SINGULAR_NAME}`,
  flags: [
    {
      name: "type",
      long: "type",
      short: "t",
      description: `${CAPITALIZED_SINGLULAR_CLI_NAME} type (multi-use or single-use) for disambiguation`,
    },
  ],
  subcommands: [],
  action: async (props) => {
    const name = props.subcommands?.[0];

    if (!is.defined(name)) {
      throw info_errors.missing_name();
    }

    const root: FileRef = props.context?.root ?? await runtime.projectRoot();

    // Resolve powerup via resolvePowerUp with global fallback (works anywhere)
    const typeFlag = is.defined(props.flags.type)
      ? (props.flags.type as PowerUpType)
      : undefined;
    const resolved = await resolvePowerUp(root, name, typeFlag, {
      fallbackToGlobal: true,
      homeDir: props.context?.homeDir,
    });
    const outputFolder = resolved.folder;
    const typeFolder = resolved.folder.up(1);

    const outputPath = outputFolder.append("/instructions.json");
    const instructions = instructionsSchema.parse(await outputPath.json());

    const collected = await collectInfo({
      outputName: name,
      outputsFolder: typeFolder,
      pathStack: [name],
      stepOverrides: {},
      excludeSteps: new Set<string>(),
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

    if (collected.reads.length > 0) {
      lines.push("## Reads");
      lines.push("");

      for (const read of collected.reads) {
        const modePart = read.mode === "jsonPath" ? ` (jsonPath: ${read.as})`
          : read.mode === "template" ? ` (template, as: ${read.as})`
          : ` (raw, as: ${read.as})`;
        lines.push(`- \`${read.path}\`${modePart}`);
      }

      lines.push("");
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