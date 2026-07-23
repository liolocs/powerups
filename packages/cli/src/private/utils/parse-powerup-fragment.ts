export interface PowerupFilter {
  include?: string[];
  exclude?: string[];
}

/**
 * Parse the `#` fragment from a source string.
 * - `#use-form` → { include: ["use-form"] }
 * - `#!use-form,use-filter` → { exclude: ["use-form", "use-filter"] }
 * - No `#` → {}
 */
export function parseFragment(source: string): {
  source: string;
  filter: PowerupFilter;
} {
  const hashIndex = source.indexOf("#");
  if (hashIndex === -1) {
    return { source, filter: {} };
  }

  const rawSource = source.slice(0, hashIndex);
  const fragment = source.slice(hashIndex + 1);

  if (fragment.startsWith("!")) {
    const exclude = fragment.slice(1).split(",").map(s => s.trim()).filter(Boolean);
    return { source: rawSource, filter: { exclude } };
  }

  const include = fragment.split(",").map(s => s.trim()).filter(Boolean);
  return { source: rawSource, filter: { include } };
}

/**
 * Merge fragment filter with --include/--exclude flag values.
 * Both contribute to the same include/exclude sets (dedup).
 */
export function mergeFilters(
  fragmentFilter: PowerupFilter,
  includeFlag?: string,
  excludeFlag?: string,
): PowerupFilter {
  const include = new Set<string>(fragmentFilter.include ?? []);
  const exclude = new Set<string>(fragmentFilter.exclude ?? []);

  if (includeFlag) {
    for (const name of includeFlag.split(",").map(s => s.trim()).filter(Boolean)) {
      include.add(name);
    }
  }

  if (excludeFlag) {
    for (const name of excludeFlag.split(",").map(s => s.trim()).filter(Boolean)) {
      exclude.add(name);
    }
  }

  const result: PowerupFilter = {};
  if (include.size > 0) result.include = [...include];
  if (exclude.size > 0) result.exclude = [...exclude];
  return result;
}

/**
 * Build the config entry from source + filter.
 * Returns a plain string if no filter, or an object if filter is present.
 */
export function buildConfigEntry(
  source: string,
  filter: PowerupFilter,
): string | { package: string; powerups?: PowerupFilter } {
  if (!filter.include && !filter.exclude) {
    return source;
  }
  const entry: { package: string; powerups?: PowerupFilter } = { package: source };
  if (filter.include || filter.exclude) {
    entry.powerups = {};
    if (filter.include) entry.powerups.include = filter.include;
    if (filter.exclude) entry.powerups.exclude = filter.exclude;
  }
  return entry;
}