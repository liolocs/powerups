/**
 * Extract the npm package name that caused an `npm install` failure from the
 * stderr that npm prints.
 *
 * npm's 404 output includes a line such as:
 *
 *   npm error 404  The requested resource 'powerup-hello-world@latest' could not be found
 *
 * or, for a scoped package:
 *
 *   npm error 404  The requested resource '@liolocs/foo@latest' could not be found
 *
 * The captured resource is `<name>@<version>`. For scoped names the name
 * itself contains an `@` (`@scope/pkg`), so the version separator is the *last*
 * `@` in the string. Returns just the package name, or `null` if no 404
 * resource line could be found.
 */
export default function extractFailedNpmPackage(stderr: string): string | null {
  const match = stderr.match(/The requested resource '([^']+)' could not be found/);
  if (match === null) {
    return null;
  }

  const resource = match[1];
  const at = resource.lastIndexOf("@");

  // `resource` is `<name>@<version>`. For scoped names (`@scope/pkg@version`)
  // the last `@` is the version separator; for unscoped names it is too. A bare
  // `@scope/pkg` with no version leaves `at === 0`, so return it as-is.
  return at > 0 ? resource.slice(0, at) : resource;
}