import { SINGULAR_NAME_FOR_CLI } from "#constants";
import checkForBuildErrors from "#utils/build/check-build-errors";
import checkInitialBuildForErrors from "#utils/build/check-initial-build-for-errors/index";
import copyTemplatesToDistFolder from "#utils/build/copy-templates-to-dist-folder";
import createInitialBuild from "#utils/build/create-initial-build";
import createInstructionsJSONFile from "#utils/build/create-instructions-json-file";
import { getPackageJson } from "#utils/build/getPackageJson";
import { Command } from "@liolocs/program";
import { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";

const build = new Command({
  name: "build",

  description: `Build a ${SINGULAR_NAME_FOR_CLI} for distribution`,

  flags: [],

  subcommands: [],

  action: async ({ context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    await checkForBuildErrors(root);

    const pkgJson = await getPackageJson(root);

    const { validatedPowerup, outputFolder: distFolderRef } =
      await createInitialBuild({ cwd: root, pkgJson });

    const {
      validatedCompiledInstructions,
      sourceFromCompiledInstructions,
    } = await checkInitialBuildForErrors({
      validatedPowerup,
      buildOutputFolder: distFolderRef,
    });

    await createInstructionsJSONFile({
      validatedCompiledInstructions,
      outputFolderRef: distFolderRef,
    });

    await copyTemplatesToDistFolder({
      instructionSteps: validatedCompiledInstructions.steps,
      cwd: root,
      distFileRef: distFolderRef,
      sourceFromCompiledInstructions,
      pkgJson,
    });
  },
});

export default build;