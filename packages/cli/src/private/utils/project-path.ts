/**
 * Encode an absolute filesystem path into a safe, collision-free directory
 * name using pi's coding-agent algorithm:
 *   1. Strip leading path separator (/ or \)
 *   2. Replace all path separators and colons with dashes
 *   3. Wrap with -- prefix and suffix
 *
 * Example: /Users/lioloc/dev/myapp → --Users-lioloc-dev-myapp--
 *
 * In production, the input is always an absolute path from process.cwd()
 * or a FileRef's path property. The raw input is used directly (without
 * path.resolve) so the encoding algorithm produces consistent results
 * cross-platform — important when a Unix machine needs to read metrics
 * written by a Windows machine or vice versa.
 */
export function encodeProjectPath(cwd: string): string {
  return `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
}

/**
 * Decode an encoded project path back to a readable path (best-effort).
 * Strips the -- wrappers and replaces dashes with slashes.
 * Lossy if the original path had hyphens in directory names.
 */
export function decodeProjectPath(encoded: string): string {
  return encoded
    .replace(/^--/, "")
    .replace(/--$/, "")
    .replace(/-/g, "/");
}