import type { FileRef } from "@rcompat/fs";
import preview_errors from "#errors/previewErrors";
import getErrorMessage from "#errors/get-error-message";

export type PreviewJsonFile = {
  variables?: Record<string, string>;
  run?: string;
  output?: string;
  watch?: boolean;
};

export default async function readPreviewJson({
  powerupRoot,
}: {
  powerupRoot: FileRef;
}): Promise<PreviewJsonFile | undefined> {
  const previewJsonRef = powerupRoot.append("/preview.json");

  if (!(await previewJsonRef.exists())) {
    return undefined;
  }

  try {
    return JSON.parse(await previewJsonRef.text()) as PreviewJsonFile;
  } catch (error) {
    throw preview_errors.preview_json_invalid(getErrorMessage(error));
  }
}
