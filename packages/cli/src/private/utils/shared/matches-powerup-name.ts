import type { PackageEntry } from "@liolocs/powerups-sdk";

/**
 * Does a config entry match the identifier the user passed on the CLI?
 *
 * `identifier` may be one of:
 *   - a powerup name (e.g. `"my-powerup"`) — matched against `entry.name`,
 *     or the part after the `:` for legacy/string entries;
 *   - a full source specifier (e.g. `"npm:@liolocs/pkg"`, `"internal:my-powerup"`);
 *   - a scoped npm package name (e.g. `"@liolocs/pkg"`).
 *
 * Source-style identifiers (containing `:` or starting with `@`) are matched
 * against the entry's source string only, so that a plain powerup name can
 * never accidentally collide with another package's source.
 */
export default function matchesPowerupName(
  entry: PackageEntry,
  identifier: string,
): boolean {
  const source = typeof entry === "string" ? entry : entry.package;
  const afterPrefix = source.includes(":")
    ? source.slice(source.indexOf(":") + 1)
    : source;

  const looksLikeSource = identifier.includes(":") || identifier.startsWith("@");

  if (looksLikeSource) {
    return identifier === source || identifier === afterPrefix;
  }

  if (typeof entry !== "string" && entry.name !== undefined) {
    return entry.name === identifier;
  }

  return afterPrefix === identifier;
}