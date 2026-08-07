import { INTERNAL_FOLDER, FOLDER_FOR_NPM_INSTALLED_PACKAGES, FOLDER_FOR_GIT_INSTALLED_PACKAGES } from "#constants";

export type SourceType = "internal" | "npm" | "git";

export interface PackageSpecifier {
  type: SourceType;
  source: string;
  name: string;
  storePath: string;
}

/**
 * Parse a source specifier into a typed descriptor.
 *
 * Supported forms:
 *  - `npm:<package>`      → npm store (`npm/node_modules/<package>`)
 *  - `http(s)://...`       → git store (`git/<domain>/<owner>/<repo>`)
 *  - bare name             → internal store (`internal/<name>`)
 *
 * `storePath` is relative to the `.<CLI_FOLDER_NAME>/` root (local or global).
 */
export function parseSpecifier(source: string): PackageSpecifier {
  // npm: prefix
  if (source.startsWith("npm:")) {
    const name = source.slice(4); // strip "npm:"
    return {
      type: "npm",
      source,
      name,
      storePath: `${FOLDER_FOR_NPM_INSTALLED_PACKAGES}/node_modules/${name}`,
    };
  }

  // http:// or https:// → git
  if (source.startsWith("http://") || source.startsWith("https://")) {
    // Normalize: strip trailing .git suffix
    const url = source.endsWith(".git") ? source.slice(0, -4) : source;
    const urlObj = new URL(url);
    const parts = urlObj.pathname.slice(1).split("/").filter(Boolean);
    const domain = urlObj.hostname;
    const owner = parts[0] ?? "";
    const repo = parts[1] ?? "";
    // storePath: git/<domain>/<owner>/<repo>
    const storePath = `${FOLDER_FOR_GIT_INSTALLED_PACKAGES}/${domain}/${owner}/${repo}`;
    return {
      type: "git",
      source,
      name: `${owner}/${repo}`,
      storePath,
    };
  }

  // Otherwise: internal
  return {
    type: "internal",
    source,
    name: source,
    storePath: `${INTERNAL_FOLDER}/${source}`,
  };
}

/**
 * Reconstruct a source specifier from a git store path.
 * Defaults to https:// protocol.
 * e.g. "git/github.com/foo/bar" → "https://github.com/foo/bar"
 */
export function reconstructGitSource(storePath: string): string {
  // Strip "git/" prefix
  const rest = storePath.slice(4); // "github.com/foo/bar"
  return `https://${rest}`;
}