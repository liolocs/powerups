import type { LiveLoader } from "astro/loaders";

/**
 * The raw data shape passed to each live collection entry.
 * The Zod schema in `src/live.config.ts` validates and types this at query time.
 */
export interface PowerupsPackageData {
	name: string;
	version: string;
	description: string;
	keywords: string[];
	license: string | null;
	publisher: string;
	date: string;
	links: {
		npm: string;
		repository: string | null;
		homepage: string | null;
	};
	searchScore: number;
	score: {
		final: number;
		quality: number;
		popularity: number;
		maintenance: number;
	};
}

/** Filter object accepted by `getLiveCollection("powerups", { keyword })`. */
export interface PowerupsCollectionFilter {
	/** Override the default `powerups-package` keyword to search for. */
	keyword?: string;
}

interface NpmSearchResponse {
	total: number;
	objects: Array<{
		package: {
			name: string;
			version: string;
			description: string | null;
			keywords: string[] | null;
			license: string | null;
			publisher: { username: string };
			date: string | null;
			links: { npm: string; repository?: string; homepage?: string };
		};
		score: {
			final: number;
			detail: { quality: number; popularity: number; maintenance: number };
		};
		searchScore: number;
	}>;
}

const NPM_SEARCH_ENDPOINT = "https://registry.npmjs.org/-/v1/search";
const DEFAULT_KEYWORD = "powerups-package";
const MAX_SEARCH_RESULTS = 250;

/**
 * A custom live loader that fetches npm packages matching a keyword
 * (default: `powerups-package`) from the npm registry search API at request time.
 */
export function npmPowerupsLoader(): LiveLoader<
	PowerupsPackageData,
	never,
	PowerupsCollectionFilter,
	Error
> {
	return {
		name: "npm-powerups-loader",

		loadCollection: async ({ filter }) => {
			const keyword = filter?.keyword ?? DEFAULT_KEYWORD;
			const url = `${NPM_SEARCH_ENDPOINT}?text=keywords:${encodeURIComponent(keyword)}&size=${MAX_SEARCH_RESULTS}`;

			try {
				const res = await fetch(url);
				if (!res.ok) {
					return { error: new Error(`npm registry responded with ${res.status} ${res.statusText}`) };
				}
				const json = (await res.json()) as NpmSearchResponse;

				return {
					entries: json.objects.map((obj) => ({
						id: obj.package.name,
						data: {
							name: obj.package.name,
							version: obj.package.version,
							description: obj.package.description ?? "",
							keywords: obj.package.keywords ?? [],
							license: obj.package.license,
							publisher: obj.package.publisher.username,
							date: obj.package.date ?? "",
							links: {
								npm: obj.package.links.npm,
								repository: obj.package.links.repository ?? null,
								homepage: obj.package.links.homepage ?? null,
							},
							searchScore: obj.searchScore,
							score: {
								final: obj.score.final,
								quality: obj.score.detail.quality,
								popularity: obj.score.detail.popularity,
								maintenance: obj.score.detail.maintenance,
							},
						} satisfies PowerupsPackageData,
					})),
				};
			} catch (err) {
				return { error: err instanceof Error ? err : new Error("Failed to fetch npm packages") };
			}
		},

		loadEntry: async ({ filter }) => {
			// `filter` for loadEntry is the entry id (package name) passed to getLiveEntry().
			const packageName = filter as unknown as string;
			try {
				const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);
				if (!res.ok) return undefined;
				const json = (await res.json()) as {
					name: string;
					description?: string;
					keywords?: string[];
					license?: string;
					maintainers?: Array<{ name?: string; username?: string }>;
					"dist-tags"?: { latest?: string };
					time?: Record<string, string>;
				};

				const latestVersion = json["dist-tags"]?.latest ?? "";
				return {
					id: json.name,
					data: {
						name: json.name,
						version: latestVersion,
						description: json.description ?? "",
						keywords: json.keywords ?? [],
						license: json.license ?? null,
						publisher: json.maintainers?.[0]?.username ?? json.maintainers?.[0]?.name ?? "",
						date: json.time?.[latestVersion] ?? "",
						links: {
							npm: `https://www.npmjs.com/package/${json.name}`,
							repository: null,
							homepage: null,
						},
						searchScore: 0,
						score: { final: 0, quality: 0, popularity: 0, maintenance: 0 },
					},
				};
			} catch {
				return undefined;
			}
		},
	};
}