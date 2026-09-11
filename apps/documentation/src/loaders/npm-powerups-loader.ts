import type { LiveLoader } from "astro/loaders";
import { instructionsSchema, type Instructions } from "@liolocs/powerups-sdk";

/**
 * The data shape of each live collection entry.
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
	downloads: {
		monthly: number;
		weekly: number;
	};
	searchScore: number;
	score: {
		final: number;
		quality: number;
		popularity: number;
		maintenance: number;
	};
	/** Full authoring instructions, validated against the SDK `instructionsSchema`. `null` when the package publishes none. */
	instructions: Instructions | null;
	/** Contents of the files referenced by create/modify steps (static `file` and dynamic `template`), keyed by their path, fetched via the unpkg CDN. */
	templateFiles: Record<string, string>;
}

/** Filter object accepted by `getLiveEntry("powerups", id)`. */
export interface PowerupsEntryFilter {
	/** The npm package name. Passed as the string `id` to `getLiveEntry()`. */
	id: string;
}

/** Filter object accepted by `getLiveCollection("powerups", { keyword })`. */
export interface PowerupsCollectionFilter {
	/** Override the default `powerups-package` keyword to search for. */
	keyword?: string;
}

// ── npm registry search (collection) ───────────────────────────────────────

interface NpmSearchResponse {
	total: number;
	objects: Array<{
		downloads: {
			monthly: number;
			weekly: number;
		};
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

// ── npm registry packument (single entry) ───────────────────────────────────

interface NpmPackumentVersion {
	version?: string;
	description?: string;
	keywords?: string[];
	license?: string;
	repository?: { url?: string };
	homepage?: string;
}

interface NpmPackument {
	name?: string;
	description?: string;
	keywords?: string[];
	license?: string;
	"dist-tags"?: { latest?: string };
	versions?: Record<string, NpmPackumentVersion>;
	maintainers?: Array<{ username?: string; name?: string }>;
	time?: Record<string, string>;
}

const NPM_SEARCH_ENDPOINT = "https://registry.npmjs.org/-/v1/search";
const NPM_REGISTRY = "https://registry.npmjs.org";
const UNPKG_BASE = "https://unpkg.com";
const DEFAULT_KEYWORD = "powerups-package";
const MAX_SEARCH_RESULTS = 250;
const INSTRUCTIONS_PATH = "dist/instructions.json";
const TEMPLATE_DIR = "dist";

async function fetchJson<T>(url: string): Promise<T | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

async function fetchText(url: string): Promise<string | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}

/**
 * Validate raw `instructions.json` text against the SDK `instructionsSchema`.
 * Returns `null` when the package publishes no instructions or the payload is invalid.
 */
function parseInstructions(raw: string | null): Instructions | null {
	if (raw === null) return null;

	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return null;
	}

	const result = instructionsSchema.safeParse(json);
	return result.success ? result.data : null;
}

/** Collect the unique `file`/`template` paths referenced by create/modify steps, preserving order. */
function collectTemplatePaths(instructions: Instructions): string[] {
	const paths = new Set<string>();
	for (const step of instructions.steps) {
		if ((step.type === "create" || step.type === "modify") && step.file !== "") {
			paths.add(step.file);
		} else if (
			(step.type === "dynamic-create" || step.type === "dynamic-modify") &&
			step.template !== ""
		) {
			paths.add(step.template);
		}
	}
	return [...paths];
}

/** Fetch every template file referenced by the instructions via the unpkg CDN. */
async function fetchTemplateFiles(
	packageName: string,
	version: string,
	instructions: Instructions,
): Promise<Record<string, string>> {
	const base = `${UNPKG_BASE}/${packageName}@${version}/${TEMPLATE_DIR}`;
	const templateFiles: Record<string, string> = {};

	const results = await Promise.all(
		collectTemplatePaths(instructions).map(async (templatePath) => {
			const content = await fetchText(`${base}/${templatePath}`);
			return { templatePath, content };
		}),
	);

	for (const { templatePath, content } of results) {
		if (content !== null) templateFiles[templatePath] = content;
	}

	return templateFiles;
}

/**
 * A custom live loader that fetches npm packages matching a keyword
 * (default: `powerups-package`) from the npm registry.
 *
 * `loadCollection` hits the search API for the directory listing.
 * `loadEntry` fetches a single package's full detail — packument plus its
 * authoring instructions and template files — so pages can consume it via
 * `getLiveEntry("powerups", packageName)` with full type safety.
 */
export function npmPowerupsLoader(): LiveLoader<
	PowerupsPackageData,
	PowerupsEntryFilter,
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

				const entries = json.objects.map((obj) => ({
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
						downloads: {
							monthly: obj.downloads.monthly,
							weekly: obj.downloads.weekly,
						},
						searchScore: obj.searchScore,
						score: {
							final: obj.score.final,
							quality: obj.score.detail.quality,
							popularity: obj.score.detail.popularity,
							maintenance: obj.score.detail.maintenance,
						},
						// The search API does not expose instructions or template files.
						instructions: null,
						templateFiles: {},
						} satisfies PowerupsPackageData,
				}));

				// Most recent package publish date across the collection, used as the
				// cache hint's lastModified so the CDN can emit a Last-Modified header.
				const lastModified = entries.reduce((latest, entry) => {
					const d = new Date(entry.data.date);
					return Number.isNaN(d.getTime()) ? latest : d > latest ? d : latest;
				}, new Date(0));

				return {
					entries,
					cacheHint: { tags: ["powerups", "powerups-listing"], lastModified },
				};
			} catch (err) {
				return { error: err instanceof Error ? err : new Error("Failed to fetch npm packages") };
			}
		},

		loadEntry: async ({ filter }) => {
			const packageName = filter.id;
			const packument = await fetchJson<NpmPackument>(
				`${NPM_REGISTRY}/${encodeURIComponent(packageName)}`,
			);

			if (packument === null) return undefined;

			const latestVersion = packument["dist-tags"]?.latest ?? "";
			const versionManifest = latestVersion ? packument.versions?.[latestVersion] : undefined;

			if (versionManifest === undefined) return undefined;

			// Fetch and validate authoring instructions from the published package.
			const pinned = `${packageName}@${latestVersion}`;
			const instructions = parseInstructions(await fetchText(`${UNPKG_BASE}/${pinned}/${INSTRUCTIONS_PATH}`));

			// Fetch only the template files referenced by the instructions.
			const templateFiles =
				instructions !== null
					? await fetchTemplateFiles(packageName, latestVersion, instructions)
					: {};

			const modified = packument.time?.modified ? new Date(packument.time.modified) : undefined;

			return {
				id: packument.name ?? packageName,
				data: {
					name: packument.name ?? packageName,
					version: versionManifest.version ?? latestVersion,
					description: versionManifest.description ?? packument.description ?? "",
					keywords: versionManifest.keywords ?? packument.keywords ?? [],
					license: versionManifest.license ?? packument.license ?? null,
					publisher:
						packument.maintainers?.[0]?.username ??
						packument.maintainers?.[0]?.name ??
						"",
					date: packument.time?.[latestVersion] ?? "",
					links: {
						npm: `https://www.npmjs.com/package/${packageName}`,
						repository: versionManifest.repository?.url ?? null,
						homepage: versionManifest.homepage ?? null,
					},
					// The registry packument does not expose download counts or scores.
					downloads: { monthly: 0, weekly: 0 },
					searchScore: 0,
					score: { final: 0, quality: 0, popularity: 0, maintenance: 0 },
					instructions,
					templateFiles,
				},
				cacheHint: {
					tags: ["powerups", `powerups:${packageName}`],
					...(modified ? { lastModified: modified } : {}),
				},
			};
		},
	};
}