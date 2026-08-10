import build_errors from "#errors/buildErrors";
import { type Path } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { type PackageJSON } from "@rcompat/type";

export async function getPackageJson(from?: Path): Promise<PackageJSON> {
  try {
    const pkgJson = await runtime.packageJSON(from);

    return pkgJson;
  } catch {
    throw build_errors.no_package_json();
  }
}