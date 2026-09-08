# Powerups Page Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache the on-demand-rendered powerups listing (`/powerups`) and detail (`/powerups/<name>`) pages at the Cloudflare edge so repeat requests within a freshness window are served from the CDN without invoking the Worker or hitting the npm registry.

**Architecture:** Use Astro 7's Route caching with the `cacheCloudflare()` CDN provider. The live loader (`npm-powerups-loader.ts`) emits a `cacheHint` (tags + `lastModified`) from both `loadCollection` and `loadEntry`. The listing component and detail page pass that hint to `Astro.cache.set()` and layer on explicit `maxAge`/`swr`. Caching is gated on `!error && Astro.cache.enabled` so failures are never pinned and dev mode (where `cache.enabled` is false) is unchanged.

**Tech Stack:** Astro 7 (`^7.3.1`), `@astrojs/cloudflare` (`^14.3.0`, includes the `cache` export), Astro Live Collections / custom live loader, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-08-powerups-page-caching-design.md`

**Verification note:** This project has no test runner. Verification per task is `astro check` (typecheck) + `astro build` (build). A final task covers manual preview/headers checks since `Astro.cache.enabled` is `false` in `astro dev`.

---

## File Structure

- **Modify** `astro.config.ts` — register the Cloudflare cache provider (one import + one config field).
- **Modify** `src/loaders/npm-powerups-loader.ts` — emit `cacheHint` from `loadCollection` and `loadEntry`. No schema or data-shape changes.
- **Modify** `src/components/pages/powerups/PowerupsListing.astro` — consume `cacheHint` from `getLiveCollection` and call `Astro.cache.set(...)`.
- **Modify** `src/pages/powerups/[...page].astro` — consume `cacheHint` from `getLiveEntry` and call `Astro.cache.set(...)` for the detail branch.

Responsibilities stay co-located: cache logic lives where each data fetch lives. The listing's caching is driven by `PowerupsListing.astro`; the detail's by `[...page].astro`. No new files.

---

## Task 1: Enable the Cloudflare cache provider

**Files:**
- Modify: `astro.config.ts`

- [ ] **Step 1: Add the `cacheCloudflare` import**

In `astro.config.ts`, add this import after the existing `cloudflare` adapter import:

```ts
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
```

The top of the file becomes:

```ts
// @ts-check

import tailwindcss from "@tailwindcss/vite"
import { defineConfig, envField } from "astro/config"
import pagefind from "astro-pagefind";
import react from "@astrojs/react"
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
```

- [ ] **Step 2: Register the cache provider**

In the `defineConfig({ ... })` call, add a `cache` field alongside `adapter`. The config object becomes:

```ts
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  },

  integrations: [react(), mdx(), pagefind()],

  env: {
    schema: {
      GITHUB_REPO_URL: envField.string({ context: "client", access: "public", default: "https://github.com/liolocs/powerups" })
    }
  },

  adapter: cloudflare(),
  cache: { provider: cacheCloudflare() },
})
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS with no errors. (If `astro check` reports the `cacheCloudflare` import or `cache` field as unknown, confirm `@astrojs/cloudflare` is `^14.3.0` or higher in `package.json` — the `cache` export was added in `@astrojs/cloudflare@14.0.0`.)

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS. Build output completes without cache-related errors.

- [ ] **Step 5: Commit**

```bash
git add astro.config.ts
git commit -m "feat: enable Cloudflare cache provider for route caching"
```

---

## Task 2: Emit `cacheHint` from `loadCollection`

**Files:**
- Modify: `src/loaders/npm-powerups-loader.ts` (the `loadCollection` method inside `npmPowerupsLoader()`)

- [ ] **Step 1: Replace the `loadCollection` body to build `entries` into a variable and return a `cacheHint`**

Replace the entire `loadCollection: async ({ filter }) => { ... }` method with:

```ts
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
```

The only structural changes vs. the original: (1) the inline `return { entries: json.objects.map(...) }` is assigned to a `const entries` variable first; (2) a `lastModified` is reduced from the entries' `date` fields; (3) the return now also includes `cacheHint`. The `entries` mapping and `satisfies PowerupsPackageData` shape are unchanged.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. `cacheHint` is already part of the live-loader collection result type, so no type changes are required.

- [ ] **Step 3: Commit**

```bash
git add src/loaders/npm-powerups-loader.ts
git commit -m "feat: emit cacheHint from powerups live collection loader"
```

---

## Task 3: Emit `cacheHint` from `loadEntry`

**Files:**
- Modify: `src/loaders/npm-powerups-loader.ts` (the `loadEntry` method inside `npmPowerupsLoader()`)

- [ ] **Step 1: Add a `modified` derivation and a `cacheHint` to the entry return**

In `loadEntry`, locate the final `return { id: ..., data: { ... } }` (the success return after `templateFiles` is computed). Insert a `modified` line immediately before it, and add a `cacheHint` field to the returned object. The final return becomes:

```ts
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
```

The `data` object is unchanged from the original; the only additions are the `modified` line and the `cacheHint` field. `packument.time` is typed as `Record<string, string> | undefined`, so `packument.time?.modified` is a valid string lookup. The two early `return undefined` paths (packument null / version manifest missing) are left untouched — they return no entry and so carry no cache hint, which is correct (nothing to cache).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/loaders/npm-powerups-loader.ts
git commit -m "feat: emit cacheHint from powerups live entry loader"
```

---

## Task 4: Apply caching in `PowerupsListing.astro`

**Files:**
- Modify: `src/components/pages/powerups/PowerupsListing.astro` (frontmatter only)

- [ ] **Step 1: Destructure `cacheHint` and call `Astro.cache.set`**

Replace this frontmatter block:

```ts
const { entries, error }: LiveDataCollectionResult<PowerupsPackageData, Error> =
	await getLiveCollection("powerups");

if (error) {
	console.error("[powerups] live collection loader error:", error.message);
} else {
	console.log("[powerups] live collection entries:", entries);
}
```

with:

```ts
const { entries, error, cacheHint }: LiveDataCollectionResult<PowerupsPackageData, Error> =
	await getLiveCollection("powerups");

if (error) {
	console.error("[powerups] live collection loader error:", error.message);
} else {
	console.log("[powerups] live collection entries:", entries);
	if (Astro.cache.enabled) {
		if (cacheHint) Astro.cache.set(cacheHint);
		Astro.cache.set({ maxAge: 900, swr: 60 });
	}
}
```

`maxAge: 900` (15 min fresh) + `swr: 60` (1 min stale-while-revalidate) matches the spec's listing window. The guard `Astro.cache.enabled` is a no-op in `astro dev` (always `false` there), so local behavior and the existing console logging are unchanged. Because this component renders as part of the `[...page].astro` response, the directive applies to that page's response.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. `LiveDataCollectionResult` already includes an optional `cacheHint`, so adding it to the destructure is type-safe.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/pages/powerups/PowerupsListing.astro
git commit -m "feat: cache powerups listing page at the edge"
```

---

## Task 5: Apply caching in `[...page].astro` (detail branch)

**Files:**
- Modify: `src/pages/powerups/[...page].astro` (frontmatter only)

- [ ] **Step 1: Apply `Astro.cache.set` after the detail fetch**

Replace this frontmatter block:

```ts
if (!isListing) {
	const result = await getLiveEntry("powerups", page);
  // @ts-ignore
  error = result.error;
  entry = result.entry;
}
```

with:

```ts
if (!isListing) {
	const result = await getLiveEntry("powerups", page);
  // @ts-ignore
  error = result.error;
  entry = result.entry;

  if (!error && Astro.cache.enabled) {
    if (result.cacheHint) Astro.cache.set(result.cacheHint);
    Astro.cache.set({ maxAge: 300, swr: 60 });
  }
}
```

`maxAge: 300` (5 min fresh) + `swr: 60` matches the spec's detail window. The `!error` guard ensures an npm failure or entry miss never gets cached (the error UI re-renders fresh each request). The `isListing` branch never reaches this block, so the listing route's caching remains driven solely by `PowerupsListing.astro` — no overlap. Preserve the existing `// @ts-ignore` above `error = result.error`.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/powerups/[...page].astro
git commit -m "feat: cache powerups detail page at the edge"
```

---

## Task 6: Verify headers, cache hits, SWR, and error bypass

**Files:** none (verification only)

`Astro.cache.enabled` is `false` in `astro dev`, so these checks run against `astro preview` (which serves the `astro build` output) or a Cloudflare deploy.

- [ ] **Step 1: Build for preview**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Start preview server**

Run: `npm run preview`
Expected: server starts on its local port.

- [ ] **Step 3: Confirm cache headers are present**

Request `/powerups` and `/powerups/<an-existing-package-name>`. Inspect response headers.
Expected: `Cloudflare-CDN-Cache-Control` is present with `max-age=900, stale-while-revalidate=60` for the listing and `max-age=300, stale-while-revalidate=60` for the detail page; `Cache-Tag` includes `powerups-listing` (listing) or `powerups:<name>` (detail) alongside `powerups`.

- [ ] **Step 4: Confirm a cache hit on second request**

Request the same URL again within the TTL window.
Expected: served from cache (in a real Cloudflare deploy, `cf-cache-status: HIT` and no fresh npm fetch in Worker logs; in local `astro preview` the cache provider is the in-memory/adapter default — confirm the response is served without re-invoking the loader by checking that the `[powerups] live collection entries` log does not repeat for the same request).

- [ ] **Step 5: Confirm SWR refresh after TTL**

Wait until `maxAge` expires, then request the same URL.
Expected: the stale response is served immediately and a background revalidate is triggered; the subsequent request reflects refreshed npm data.

- [ ] **Step 6: Confirm errors are not cached**

Temporarily make the npm registry unreachable (e.g. add a `return { error: new Error("simulated") }` at the top of `loadCollection`, rebuild, and request `/powerups`), then revert the change and rebuild. Confirm during the simulated failure that repeated requests keep attempting the fetch (the error page is not served from cache).

- [ ] **Step 7: Confirm dev mode is unchanged**

Run: `npm run dev`
Request `/powerups` and confirm `Astro.cache.enabled` is false — every request re-fetches npm (the `[powerups] live collection entries` log repeats per request) and client-side search/sort still works.

- [ ] **Step 8: Final commit (if any revert/cleanup from Step 6)**

If Step 6 required a temporary code change, ensure it is reverted and the working tree is clean:

```bash
git status
```
Expected: clean tree (no leftover simulated-error code).

---

## Self-Review

**Spec coverage:**
- Config / Cloudflare provider → Task 1.
- Loader `cacheHint` for collection → Task 2.
- Loader `cacheHint` for entry → Task 3.
- Listing page `Astro.cache.set` (maxAge 900 / swr 60, gated) → Task 4.
- Detail page `Astro.cache.set` (maxAge 300 / swr 60, gated on `!error`) → Task 5.
- Error handling (errors not cached), dev behavior (`cache.enabled` false), client-side search/sort unaffected → Tasks 4, 5, 6.
- Manual testing (headers, cache hit, SWR, error bypass, dev parity) → Task 6.
- Out of scope (invalidation endpoint, other routes, schema changes) → intentionally no tasks.

No gaps.

**Placeholder scan:** No TBD/TODO/"add appropriate..." placeholders. Every code step contains the full final code. Verification steps contain exact commands and expected outcomes.

**Type consistency:** `cacheHint` shape is consistent across the loader (`{ tags: [...], lastModified }`) and the pages (destructured as `cacheHint`, passed to `Astro.cache.set(cacheHint)`). Tags are consistent: collection emits `["powerups", "powerups-listing"]`; entry emits `["powerups", "powerups:<name>"]`. TTL values are consistent: listing `maxAge: 900, swr: 60`; detail `maxAge: 300, swr: 60`. `Astro.cache.enabled` guard used identically in both pages.