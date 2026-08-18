import build_errors from "#errors/buildErrors";
import { type Instructions, instructionsSchema } from "@liolocs/powerups-sdk";
import {
  getListOfIssuesWithInstructions,
} from "#utils/build/check-compiled-instructions-for-errors/get-list-of-issues-with-instructions";

export default async function checkCompiledInstructionsForErrors(
  compiledInstructions: Instructions,
): Promise<{
  validatedCompiledInstructions: Instructions;
}> {
  const validatedCompiledInstructions =
    checkForValidInstructionsSchema(compiledInstructions);

  await checkForValidationIssues(validatedCompiledInstructions);

  return {
    validatedCompiledInstructions: validatedCompiledInstructions,
  };
}

async function checkForValidationIssues(instructions: Instructions) {
  const validationIssues = await getListOfIssuesWithInstructions(instructions);

  if (validationIssues.length > 0) {
    throw build_errors.build_validation_failed(validationIssues);
  }
}

function checkForValidInstructionsSchema(instructions: unknown) {
  const schemaResult = instructionsSchema.safeParse(instructions);

  if (!schemaResult.success) {
    throw build_errors.malformed_instructions(schemaResult.error.message);
  }

  return schemaResult.data;
}

// function checkCompiledIndexFileForValidExports({
//   compiledIndexFile,
//   instructionsPath,
// }: {compiledIndexFile: any; instructionsPath: string}): void {
//   if (
//     is.falsy(compiledIndexFile.default) ||
//     typeof compiledIndexFile.default !== "object" ||
//     is.falsy(compiledIndexFile.default.instructions)
//   ) {
//     throw build_errors.invalid_instructions_file(instructionsPath);
//   }
// }
