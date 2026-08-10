import { PACKAGE_JSON_KEYWORD_PROPERTY, PACKAGE_JSON, SINGULAR_NAME_FOR_CLI } from "#constants";
import build_errors from "#errors/buildErrors";
import { powerupPropertySchema } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";

export default async function checkForPreBuildErrors(cwd: FileRef)
: Promise<void> {
  const packageJsonRef = await checkForExistingPackageJson(cwd);

  const pkgJson = await checkForPowerupKeyword(packageJsonRef);

  checkForValidPowerupPropertyShape(pkgJson[SINGULAR_NAME_FOR_CLI]);
}

async function checkForPowerupKeyword(packageJsonRef: FileRef)
: Promise<Record<string, unknown>> {
  const pkgJson = await packageJsonRef.json() as Record<string, unknown>;
  const keywords = pkgJson.keywords;

  if (!Array.isArray(keywords) ||
      !keywords.includes(PACKAGE_JSON_KEYWORD_PROPERTY)
  ) {
    throw build_errors.not_a_powerups_package();
  }

  return pkgJson;
}

async function checkForExistingPackageJson(cwd: FileRef): Promise<FileRef> {
  const packageJsonRef = cwd.append(`/${PACKAGE_JSON}`);

  if (!(await packageJsonRef.exists())) {
    throw build_errors.no_package_json();
  }

  return packageJsonRef;
}

export function checkForValidPowerupPropertyShape(powerupProperty: unknown)
: void {
  const validatedPowerup = powerupPropertySchema.safeParse(powerupProperty);

  if (!validatedPowerup.success) {
    throw build_errors.malformed_powerup_property(validatedPowerup.error.message);
  }
}