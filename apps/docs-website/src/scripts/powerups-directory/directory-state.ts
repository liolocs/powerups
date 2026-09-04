import type { PowerupSummary } from "./fetch-powerups.ts";

export const PAGE_SIZE = 50;

export type DirectorySort = "most-downloads" | "recently-published" | "name-asc" | "name-desc";

export interface DirectoryState {
  query: string;
  sort: DirectorySort;
  page: number;
}

export const DEFAULT_DIRECTORY_STATE: DirectoryState = {
  query: "",
  sort: "most-downloads",
  page: 1,
};

export interface PaginatedPowerups {
  slice: PowerupSummary[];
  total: number;
  firstIndex: number;
  lastIndex: number;
  totalPages: number;
}

const nameCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function filterPowerups({ powerups, query }: { powerups: PowerupSummary[]; query: string }): PowerupSummary[] {
  const trimmedQuery = query.trim().toLowerCase();

  if (trimmedQuery === "") {
    return powerups;
  }

  return powerups.filter((powerup) => {
    const haystack = [powerup.name, powerup.description, ...powerup.keywords].join(" ").toLowerCase();
    return haystack.includes(trimmedQuery);
  });
}

export function sortPowerups({ powerups, sort }: { powerups: PowerupSummary[]; sort: DirectorySort }): PowerupSummary[] {
  const comparators: Record<DirectorySort, (first: PowerupSummary, second: PowerupSummary) => number> = {
    "most-downloads": (first, second) =>
      second.monthlyDownloads - first.monthlyDownloads || nameCollator.compare(first.name, second.name),
    "recently-published": (first, second) =>
      (Date.parse(second.publishedAt) || 0) - (Date.parse(first.publishedAt) || 0) || nameCollator.compare(first.name, second.name),
    "name-asc": (first, second) => nameCollator.compare(first.name, second.name),
    "name-desc": (first, second) => nameCollator.compare(second.name, first.name),
  };

  return [...powerups].sort(comparators[sort]);
}

export function paginatePowerups({ powerups, page, pageSize }: {
  powerups: PowerupSummary[];
  page: number;
  pageSize: number;
}): PaginatedPowerups {
  const total = powerups.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    slice: powerups.slice(start, start + pageSize),
    total,
    firstIndex: total === 0 ? 0 : start + 1,
    lastIndex: Math.min(start + pageSize, total),
    totalPages,
  };
}

export function pagerPageNumbers({ page, totalPages }: { page: number; totalPages: number }): (number | "gap")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const windowStart = Math.max(2, Math.min(page - 1, totalPages - 2));
  const windowEnd = Math.min(totalPages - 1, Math.max(page + 1, 3));
  const entries: (number | "gap")[] = [1];

  if (windowStart > 2) {
    entries.push("gap");
  }
  for (let pageNumber = windowStart; pageNumber <= windowEnd; pageNumber += 1) {
    entries.push(pageNumber);
  }
  if (windowEnd < totalPages - 1) {
    entries.push("gap");
  }

  entries.push(totalPages);
  return entries;
}
