export interface NpmSearchObject {
  downloads?: { monthly?: number; weekly?: number };
  updated?: string;
  package?: {
    name?: string;
    version?: string;
    description?: string;
    keywords?: string[];
    date?: string;
    publisher?: { username?: string };
    links?: { npm?: string; repository?: string };
  };
}

export interface PowerupSummary {
  name: string;
  description: string;
  version: string;
  publishedAt: string;
  updatedAt: string;
  monthlyDownloads: number;
  publisherUsername: string;
  npmUrl: string;
  repositoryUrl: string | null;
  keywords: string[];
}

export interface FetchPowerupsResult {
  powerups: PowerupSummary[];
  total: number;
}

const SEARCH_ENDPOINT = "https://registry.npmjs.org/-/v1/search";
const SEARCH_QUERY = "keywords:powerups-package";
const SEARCH_PAGE_SIZE = 250;
const MAX_SEARCH_PAGES = 40;

export function normalizeSearchObject({ searchObject }: { searchObject: NpmSearchObject }): PowerupSummary {
  const packageInfo = searchObject.package ?? {};
  const name = packageInfo.name ?? "";
  const npmUrl = packageInfo.links?.npm ?? (name === "" ? "" : `https://www.npmjs.com/package/${name}`);

  return {
    name,
    description: packageInfo.description ?? "",
    version: packageInfo.version ?? "",
    publishedAt: packageInfo.date ?? "",
    updatedAt: searchObject.updated ?? "",
    monthlyDownloads: searchObject.downloads?.monthly ?? 0,
    publisherUsername: packageInfo.publisher?.username ?? "",
    npmUrl,
    repositoryUrl: packageInfo.links?.repository ?? null,
    keywords: packageInfo.keywords ?? [],
  };
}

export async function fetchPowerups(): Promise<FetchPowerupsResult> {
  const powerups: PowerupSummary[] = [];
  let total = 0;

  for (let pageIndex = 0; pageIndex < MAX_SEARCH_PAGES; pageIndex += 1) {
    const offset = pageIndex * SEARCH_PAGE_SIZE;
    const searchUrl = `${SEARCH_ENDPOINT}?text=${SEARCH_QUERY}&size=${SEARCH_PAGE_SIZE}&from=${offset}`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new Error(`npm search request failed with status ${response.status}`);
    }

    const page = (await response.json()) as { total?: number; objects?: NpmSearchObject[] };
    const objects = page.objects ?? [];
    if (typeof page.total === "number") {
      total = page.total;
    }
    powerups.push(...objects.map((searchObject) => normalizeSearchObject({ searchObject })));

    if (objects.length < SEARCH_PAGE_SIZE) {
      return { powerups, total };
    }
  }

  return { powerups, total };
}
