import { type Instructions, packageDependencyGroupArraySchema } from "#schemas/instruction";
import is from "@rcompat/is";
import create_errors from "#errors/createErrors";

export function getPackageDependencies(packageDeps?: string): Instructions["packageDependencies"] {
  let packageDependencies: Instructions["packageDependencies"] = undefined;

  if (is.defined(packageDeps) && packageDeps.length > 0) {
    try {
      packageDependencies = packageDependencyGroupArraySchema.parse(
        JSON.parse(packageDeps),
      ) as Instructions["packageDependencies"];
    } catch {
      throw create_errors.invalid_package_deps_json();
    }
  }

  return packageDependencies;
}