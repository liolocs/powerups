import { SINGULAR_NAME_FOR_CLI } from "#constants";
import checkForPreBuildErrors from "#utils/build/check-pre-build-errors";
import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import copyTemplatesToDistFolder from "#utils/build/copy-templates-to-dist-folder";
import compileIndexFile from "#utils/build/compile-index-file";
import createInstructionsJSONFile from "#utils/build/create-instructions-json-file";
import { getPackageJson } from "#utils/build/getPackageJson";
import { Command } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";

const build = new Command({
  name: "build",

  description: `Build a ${SINGULAR_NAME_FOR_CLI} for distribution`,

  flags: [],

  subcommands: [],

  action: async ({ context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();

    await checkForPreBuildErrors(root);

    const pkgJson = await getPackageJson(root);

    const { compiledIndexFile, outputFolder: distFolderRef } =
      await compileIndexFile({ root, pkgJson });

    const {
      validatedCompiledInstructions,
    } = await checkCompiledInstructionsForErrors(
      compiledIndexFile.default.instructions,
    );

    await createInstructionsJSONFile({
      validatedCompiledInstructions,
      outputFolderRef: distFolderRef,
    });

    await copyTemplatesToDistFolder({
      instructionSteps: validatedCompiledInstructions.steps,
      cwd: root,
      distFileRef: distFolderRef,
      sourceFromCompiledInstructions: compiledIndexFile.default.source,
      powerupName: validatedCompiledInstructions.name,
    });
  },
});

export default build;