import { SINGULAR_NAME_FOR_CLI } from "#constants";
import { Command, type Flag } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import cli from "@rcompat/cli";

import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import loadInstructionsFromSource from "#utils/preview/load-instructions-from-source";
import resolvePreviewConfig from "#utils/preview/resolve-preview-config";
import materializePreview from "#utils/preview/materialize-preview";
import { readPreviewManifest } from "#utils/preview/preview-manifest";
import { watchSources } from "#utils/preview/watch-source";
import getStepSourcePaths from "#utils/preview/get-step-source-paths";
import { startSupervisor, runCommandOnce, sweepStalePreview } from "#utils/preview/run-supervisor";
import getErrorMessage from "#errors/get-error-message";

const execFlag = {
  name: "exec", long: "exec", short: "e",
  description: `Shell command to run inside the preview dir (overrides preview.json)`,
} as const satisfies Flag;

const outputDirFlag = {
  name: "outputDir", long: "output-dir", short: "o",
  description: `Preview output directory (default: preview)`,
} as const satisfies Flag;

const watchFlag = {
  name: "watch", long: "watch", short: "w",
  description: "Watch powerup sources and re-render on change (default: true when exec is set)",
  type: "boolean",
} as const satisfies Flag;

const preview = new Command({
  name: "preview",
  description: `Materialize a ${SINGULAR_NAME_FOR_CLI} from source with concrete variables and optionally run it`,
  flags: [execFlag, outputDirFlag, watchFlag],
  subcommands: [],

  action: async ({ context, rawFlags }) => {
    const powerupRoot: FileRef = context?.root ?? runtime.cwd();

    const instructions = await loadInstructionsFromSource({ powerupRoot });
    const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(instructions);

    const config = await resolvePreviewConfig({
      powerupRoot,
      instructions: validatedCompiledInstructions,
      rawFlags: rawFlags ?? [],
    });

    const previewDir = powerupRoot.append(`/${config.outputDir}`);

    const stalePid = await sweepStalePreview({ previewDir });

    if (stalePid !== undefined) {
      const yellow = cli.fg.yellow;
      cli.print(`${yellow("!")} killed stale preview process (pid ${stalePid})\n`);
    }

    const isFirstMaterialize = Object.keys(await readPreviewManifest({ previewDir })).length === 0;

    const first = await materializePreview({
      powerupRoot,
      instructions: validatedCompiledInstructions,
      config,
      isFirstMaterialize,
    });

    printPreviewSummary({ previewDir, ...first });

    if (config.exec === undefined) {
      return;
    }

    if (!config.watch) {
      const once = runCommandOnce({ runCommand: config.exec, previewDir });
      wireCleanup({ stop: () => once.stop() });
      return;
    }

    const supervisor = startSupervisor({ runCommand: config.exec, previewDir });

    const watcher = watchSources({
      powerupRoot,
      extraPaths: getStepSourcePaths({ instructions: validatedCompiledInstructions }),
      onChange: async () => {
        try {
          const rerender = await materializePreview({
            powerupRoot,
            instructions: await reloadInstructions({ powerupRoot }),
            config: await reloadConfig({ powerupRoot, instructions: validatedCompiledInstructions, rawFlags: rawFlags ?? [] }),
            isFirstMaterialize: false,
          });

          printPreviewSummary({ previewDir, ...rerender });

          if (rerender.outputChanged) {
            supervisor.restart();
          }
        } catch (error) {
          const yellow = cli.fg.yellow;
          cli.print(`${yellow("!")} re-render failed (keeping last-good preview): ${getErrorMessage(error)}\n`);
        }
      },
    });

    wireCleanup({
      stop: () => {
        watcher.stop();
        supervisor.stop();
      },
    });

    await new Promise(() => {});
  },
});

async function reloadInstructions({ powerupRoot }: { powerupRoot: FileRef }) {
  const instructions = await loadInstructionsFromSource({ powerupRoot });
  const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(instructions);
  return validatedCompiledInstructions;
}

async function reloadConfig({
  powerupRoot,
  instructions,
  rawFlags,
}: {
  powerupRoot: FileRef;
  instructions: import("@liolocs/powerups-sdk").Instructions;
  rawFlags: { flag: string; value?: string }[];
}) {
  return resolvePreviewConfig({ powerupRoot, instructions, rawFlags });
}

function printPreviewSummary({
  previewDir,
  generatedPaths,
  stalePaths,
  skippedSteps,
}: {
  previewDir: FileRef;
  generatedPaths: string[];
  stalePaths: string[];
  skippedSteps: string[];
}): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  cli.print(`${green("✓")} Preview materialized: ${generatedPaths.length} files → ${previewDir.path}\n`);

  if (stalePaths.length > 0) {
    cli.print(`  ${dim(`removed stale: ${stalePaths.length}`)}\n`);
  }

  for (const skippedStep of skippedSteps) {
    cli.print(`  ${dim(`skipped: ${skippedStep} (target missing)`)}\n`);
  }
}

function wireCleanup({ stop }: { stop: () => void }): void {
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    stop();
  };

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      cleanup();
      process.exit(0);
    });
  }

  process.on("exit", cleanup);
}

export default preview;