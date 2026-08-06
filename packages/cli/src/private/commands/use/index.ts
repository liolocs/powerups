import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import use_errors from "#errors/useErrors";
import { instructionsSchema, type Instructions, type Step } from "@liolocs/powerups-sdk";
import { extractVariables } from "#utils/variables";
import { executeSteps, type RunRecord } from "#utils/execute-steps";
import { preFlight } from "#utils/pre-flight";
import { revertChanges } from "#utils/revert";
import { verifyGitRepo, ensureCleanTree } from "#utils/git";
import { readManifest, appendManifestEntry, hasBeenApplied, type ManifestEntry } from "#utils/manifest";
import { logRun } from "#utils/metrics";
import { resolvePowerUp } from "#utils/resolve-powerup";
import {
  CAPITALIZED_SINGLULAR_CLI_NAME,
  MAIN_FOLDER,
  PACKAGE_FILE,
  SINGULAR_NAME,
  type PowerUpType,
} from "#constants";

const EXCLUDE_FLAGS = ["--dry-run", "-d", "--overwrite", "-O", "--help", "-h", "--type", "-t"];

interface FromInfo { name: string; singleUse: boolean }

function fromOf(step: Step): FromInfo | undefined {
  return (step as Step & { from?: FromInfo }).from;
}

function buildManifestEntry(
  instructions: Instructions,
  record: RunRecord,
  meta: { packageName: string; version: string; location: "local" | "global"; variables: Record<string, string> },
): ManifestEntry {
  return {
    powerup: instructions.name,
    package: meta.packageName,
    version: meta.version,
    location: meta.location,
    type: instructions.type,
    timestamp: new Date().toISOString(),
    variables: meta.variables,
    steps: record.steps,
    files: record.files,
  };
}

/**
 * Build one manifest entry per included powerup (grouped by `from.name` among
 * applied steps), so an included single-use powerup is blocked standalone later.
 */
function includedPowerupEntries(
  record: RunRecord,
  fromInfo: Map<string, FromInfo>,
  meta: { packageName: string; version: string; location: "local" | "global" },
): ManifestEntry[] {
  const byName = new Map<string, typeof record.steps>();
  for (const s of record.steps) {
    if (s.from && s.status !== "skipped-already-applied") {
      const arr = byName.get(s.from) ?? [];
      arr.push(s);
      byName.set(s.from, arr);
    }
  }

  const entries: ManifestEntry[] = [];
  for (const [name, steps] of byName) {
    const info = fromInfo.get(name);
    entries.push({
      powerup: name,
      package: meta.packageName,
      version: meta.version,
      location: meta.location,
      type: info?.singleUse ? "single-use" : "multi-use",
      timestamp: new Date().toISOString(),
      variables: {},
      steps,
      files: [],
    });
  }
  return entries;
}

const use = new Command({
  name: "use",
  description: `Use a ${SINGULAR_NAME}, rendering templates with variables`,
  flags: [
    { name: "type", long: "type", short: "t", description: `${CAPITALIZED_SINGLULAR_CLI_NAME} type (multi-use or single-use) for disambiguation` },
    { name: "dry-run", long: "dry-run", short: "d", description: "Print output to stdout instead of writing files" },
    { name: "overwrite", long: "overwrite", short: "O", description: "Overwrite existing destination files for create actions" },
  ],
  subcommands: [],
  action: async ({ subcommands, rawFlags, flags, context }) => {
    const name = subcommands?.[0];
    if (!is.defined(name)) {
      throw use_errors.missing_name();
    }

    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    if (!(await fs.exists(mainFolder))) {
      throw use_errors.main_folder_not_found();
    }

    const typeFlag = is.defined(flags.type) ? (flags.type as PowerUpType) : undefined;
    const resolved = await resolvePowerUp(root, name, typeFlag);
    const packageDir = resolved.folder.up(1);
    const outputFolder = resolved.folder;

    if (!(await fs.exists(outputFolder.append("/instructions.json")))) {
      throw use_errors.instructions_not_built(name);
    }

    const instructions = instructionsSchema.parse(
      await outputFolder.append("/instructions.json").json(),
    );

    const variables = extractVariables({
      rawFlags: rawFlags ?? [],
      required: instructions.variables.required,
      optional: instructions.variables.optional ?? [],
      excludeFlags: EXCLUDE_FLAGS,
      onMissing: (missing) => {
        throw use_errors.missing_variables(missing, instructions.variables.required, name);
      },
    });

    const isDryRun = (rawFlags ?? []).some(f => f.flag === "--dry-run" || f.flag === "-d");
    const isOverwrite = (rawFlags ?? []).some(f => f.flag === "--overwrite" || f.flag === "-O");

    // single-use check (top-level)
    if (instructions.type === "single-use" && (await hasBeenApplied(root, instructions.name))) {
      throw use_errors.already_applied(instructions.name);
    }

    // from.name → singleUse map for included-powerup manifest entries
    const fromInfo = new Map<string, FromInfo>();
    for (const step of instructions.steps) {
      const f = fromOf(step);
      if (f) {
        fromInfo.set(f.name, f);
      }
    }

    // skip steps from already-applied included single-use powerups
    const manifest = await readManifest(root);
    const appliedNames = new Set(manifest.map(e => e.powerup));
    const skipMark = "__skipAlreadyApplied";
    const effectiveSteps = instructions.steps.map(step => {
      const f = fromOf(step);
      if (f?.singleUse && appliedNames.has(f.name)) {
        return { ...step, [skipMark]: true } as Step & Record<string, unknown>;
      }
      return step;
    });

    const record: RunRecord = { steps: [], files: [], totalCharacters: 0 };

    let version = "0.0.0";
    try {
      const pkgJson = await packageDir.append(`/${PACKAGE_FILE}`).json() as { version?: string };
      version = pkgJson.version ?? version;
    } catch { /* best-effort */ }

    const meta = { packageName: resolved.packageName, version, location: resolved.location, variables };

    const runnable = effectiveSteps.filter(s => !(s as Record<string, unknown>)[skipMark]);

    if (isDryRun) {
      await executeSteps({
        steps: runnable, variables, outputFolder, rootDir: root,
        isDryRun: true, isOverwrite, record,
      });
      for (const s of effectiveSteps) {
        if ((s as Record<string, unknown>)[skipMark]) {
          record.steps.push({ name: s.name, type: s.type, status: "skipped-already-applied", from: fromOf(s)?.name });
        }
      }
      return;
    }

    // non-dry-run: clean git state required (for targeted revert on failure)
    await verifyGitRepo(root);
    await ensureCleanTree(root);

    // pre-flight
    await preFlight({ instructions, outputFolder, rootDir: root, variables, isOverwrite });

    try {
      await executeSteps({
        steps: runnable, variables, outputFolder, rootDir: root,
        isDryRun: false, isOverwrite, record,
      });
    } catch (error) {
      await revertChanges(root, record.files);
      throw error;
    }

    // record skipped-already-applied steps
    for (const s of effectiveSteps) {
      if ((s as Record<string, unknown>)[skipMark]) {
        record.steps.push({ name: s.name, type: s.type, status: "skipped-already-applied", from: fromOf(s)?.name });
      }
    }

    // no-op: every step skipped
    if (record.steps.every(s => s.status !== "applied")) {
      cli.print(`Nothing to do — all steps already applied or skipped.\n`);
      return;
    }

    // append manifest entries (parent + each included powerup)
    await appendManifestEntry(root, buildManifestEntry(instructions, record, meta));
    for (const entry of includedPowerupEntries(record, fromInfo, meta)) {
      await appendManifestEntry(root, entry);
    }

    // metrics (best-effort)
    try {
      await logRun(
        { output: name, characters: record.totalCharacters },
        { cwd: root.path, globalRoot: context?.globalRoot },
      );
    } catch { /* secondary */ }
  },
});

export default use;