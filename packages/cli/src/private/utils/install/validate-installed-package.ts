import fs, { type FileRef } from "@rcompat/fs";
import { PACKAGE_JSON, PACKAGE_JSON_KEYWORD_PROPERTY } from "#constants";
import install_errors from "#errors/installErrors";
import getValidatedPowerupProperty from "#utils/validate/get-validated-powerup-property";

export default async function validateInstalledPackage({
  packageDir,
  source,
}: {
  packageDir: FileRef;
  source: string;
}): Promise<void> {
  const pkgJsonPath = packageDir.append(`/${PACKAGE_JSON}`);

  if (!(await fs.exists(pkgJsonPath))) {
    throw install_errors.not_a_powerups_package(source, "package.json not found after install");
  }

  const pkgJson = await pkgJsonPath.json() as Record<string, unknown>;
  const keywords = pkgJson.keywords;

  if (!Array.isArray(keywords) || !keywords.includes(PACKAGE_JSON_KEYWORD_PROPERTY)) {
    throw install_errors.not_a_powerups_package(
      source,
      `Missing "${PACKAGE_JSON_KEYWORD_PROPERTY}" keyword in package.json`,
    );
  }

  const distInstructionsPath = packageDir.append("/dist/instructions.json");
  if (!(await fs.exists(distInstructionsPath))) {
    throw install_errors.not_a_powerups_package(source, "Package has not been built — dist/instructions.json not found");
  }

  getValidatedPowerupProperty(pkgJson);
}