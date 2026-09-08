# Powerups Page Caching — Design

**Date:** 2026-09-08
**Scope:** `astro.config.ts`, `src/loaders/npm-powerups-loader.ts`, `src/components/pages/powerups/PowerupsListing.astro`, `src/pages/powerups/[...page].astro`

## Problem

The powerups listing (`/powerups`) and detail (`/powerups/<name>`) pages are on-demand rendered (`prerender = false`) and fetch live data from the npm registry + unpkg CDN on **every request**. Today there is no caching: no cache provider is configured, no `Astro.cache` calls exist, and the live loader emits no `cacheHint`. Each page view triggers npm search / packument / unpkg fetches, adding latency and load.

## Goal

Cache the rendered listing and detail pages at the Cloudflare edge so repeat requests within a freshness window are served from the CDN without invoking the Worker or hitting npm. Use stale-while-revalidate so users always get an instant response while a background refresh keeps data reasonably current.

## Decisions

- **Freshness:** Listing fresh for 15 min (`maxAge: 900`), detail fresh for 5 min (`maxAge: 300`); both serve stale for 1 min while revalidating (`swr: 60`). npm data (package list, descriptions, downloads, versions) drifting this much is acceptable.
- **Invalidation:** Time-based expiry + SWR only. No manual purge endpoint is built. Tags are still attached so targeted invalidation can be added later without changing the data layer.
- **Scope:** Enrich the loader with `cacheHint` (data-layer integration) **and** apply caching per-route via `Astro.cache.set()`. Cache logic stays co-located with each data fetch.

## Architecture

Use Astro 7's Route caching with the Cloudflare CDN cache provider (`cacheCloudflare()` from `@astrojs/cloudflare/cache`). The provider maps `Astro.cache.set(...)` directives into `Cloudflare-CDN-Cache-Control` and `Cache-Tag` headers and enables Cloudflare Workers Cache. Cache hits are served from the edge without invoking the server function.

The live loader emits a `cacheHint` (`tags` + `lastModified`) from both `loadCollection` and `loadEntry`. The pages consume that hint via `getLiveCollection` / `getLiveEntry` and pass it to `Astro.cache.set()`, then layer on the explicit `maxAge` / `swr`.

```
Request → Cloudflare edge
  ├─ cache HIT  → serve cached HTML (no Worker, no npm)
  └─ cache MISS/STALE
        → invoke Worker → Astro route
            → getLiveCollection/getLiveEntry → npm registry + unpkg
            → loader returns cacheHint (tags, lastModified)
            → Astro.cache.set(cacheHint) + Astro.cache.set({ maxAge, swr })
            → render → response with Cloudflare-CDN-Cache-Control/Cache-Tag
        → edge stores response; STALE triggers background revalidate
```

## Changes

### 1. `astro.config.ts` — enable the Cloudflare cache provider

```ts
import { cacheCloudflare } from "@astrojs/cloudflare/cache";

export default defineConfig({
  adapter: cloudflare(),
  cache: { provider: cacheCloudflare() },
  // ...existing vite, integrations, env
});
```

This is the only global change. No caching occurs until a route explicitly calls `cache.set`.

### 2. `src/loaders/npm-powerups-loader.ts` — emit `cacheHint`

`cacheHint` is already part of the live-loader result type, so `getLiveCollection` / `getLiveEntry` will expose it as a third field. No schema or data-shape changes.

**`loadCollection`** — tag the listing; derive `lastModified` from the most recent package publish `date` across entries:

```ts
// after building `entries`:
const lastModified = entries.reduce((latest, e) => {
  const d = new Date(e.data.date);
  return d > latest ? d : latest;
}, new Date(0));

return {
  entries,
  cacheHint: { tags: ["powerups", "powerups-listing"], lastModified },
};
```

**`loadEntry`** — tag per-package; use npm's own `packument.time.modified`:

```ts
const modified = packument.time?.modified ? new Date(packument.time.modified) : undefined;

return {
  id: ...,
  data: ...,
  cacheHint: {
    tags: ["powerups", `powerups:${packageName}`],
    ...(modified ? { lastModified: modified } : {}),
  },
};
```

### 3. `src/components/pages/powerups/PowerupsListing.astro` — apply caching

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

The `cache.set` calls live here because the collection fetch (and its `cacheHint`) live here. Since this component renders as part of the `[...page].astro` response, the directive applies to that page's response.

### 4. `src/pages/powerups/[...page].astro` — apply caching (detail only)

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

The `isListing` branch never reaches this block, so the listing route's caching is driven solely by `PowerupsListing.astro` and the detail route's by this block — no overlap.

## Error Handling & Dev Behavior

- **Errors aren't cached.** Both pages gate `cache.set` behind `!error`, so an npm registry failure or `getLiveEntry` miss renders the existing error UI fresh every request — never pinned in the CDN.
- **Dev mode is unaffected.** `Astro.cache.enabled` is always `false` in `astro dev`, so the `if (Astro.cache.enabled)` guards are no-ops locally. npm fetches run every request exactly as today, and `console.log` / `console.error` output is unchanged. Caching only activates in `astro preview` / deployed Cloudflare.
- **Client-side search/sort is unaffected.** The `<script>` in `PowerupsListing.astro` operates over already-rendered DOM cards; caching the HTML does not change its behavior.

## Testing

Manual (cache is disabled in `astro dev`):

1. **Headers present in preview/deployed** — request `/powerups` and `/powerups/<name>`; confirm `Cloudflare-CDN-Cache-Control` and `Cache-Tag` headers carry the expected `max-age` / `stale-while-revalidate` and tags (`powerups-listing`, `powerups:<name>`).
2. **Cache hit** — a second request within TTL is served from the Cloudflare edge (`cf-cache-status: HIT`) with no fresh npm fetch in the Worker logs.
3. **SWR refresh** — after `maxAge` expires, the next request serves stale immediately and triggers a background revalidate; the following request reflects refreshed npm data.
4. **Errors bypass cache** — simulate an npm failure (e.g. block `registry.npmjs.org`); confirm the error page is not cached (repeated requests still attempt the fetch).
5. **Dev unchanged** — `astro dev`: `Astro.cache.enabled` is false, every request re-fetches npm, search/sort still works.

## Out of Scope

- Manual/tag-based invalidation endpoint (e.g. `/api/revalidate`). Tags are attached now so this can be added later without touching the data layer.
- Caching of the docs pages or any other route.
- Changes to the live collection schema or the `PowerupsPackageData` shape.