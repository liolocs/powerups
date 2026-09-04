# Powerups directory & detail pages — Design

**Date:** 2026-09-04
**Status:** Approved in brainstorm; ready for implementation planning
**Scope:** `apps/docs-website` — rewrite `src/pages/powerups.astro`, add `src/pages/powerups/view.astro`

## 1. Overview

Two pages in the Starlight docs site:

1. **Directory** (`/powerups/`) — every published powerup shown as a card, with a search bar, sort options, and pagination.
2. **Detail** (`/powerups/view?package=<name>`) — a powerup's metadata, its execution steps, and the template files (viewable code) so users can inspect a powerup before installing it.

**Data strategy (decided):** fully client-side. Pages ship as static shells; the browser queries the npm registry directly (registry search and tarball endpoints are CORS-enabled). This matches the fetch pattern already present in the current `powerups.astro`. The site keeps its existing static-output Starlight setup — no SSR adapter.

## 2. Decisions from brainstorming

| Topic | Decision |
| --- | --- |
| Data strategy | Fully client-side (browser fetches npm registry) |
| Card design | Rich metadata: name + npm/GitHub links, description, publisher avatar + username, version chip, downloads/mo |
| Detail layout | Summary steps section + separate tabbed "Template files" section |
| Code display | Plain styled `<pre>` blocks (no syntax-highlighting dependency) |
| Sort semantics | "Most downloads" (default) / "Recently published" / "Ascending" = A→Z name / "Descending" = Z→A name |
| Search behavior | Sort dropdown applies instantly; **Search** applies the query and jumps to page 1; **Clear** resets query, sort, and page |
| Page size | 50 cards per page; header shows `1-50 / 3002`-style range |

## 3. Architecture

### Files

| File | Purpose |
| --- | --- |
| `src/pages/powerups.astro` | Directory page: `StarlightPage` shell, static scaffold (header, toolbar, grid, pager), client script |
| `src/pages/powerups/view.astro` | Detail page: `StarlightPage` shell, static scaffold, client script |
| `src/scripts/powerups-directory/fetch-powerups.ts` | Paged npm search fetch + normalization |
| `src/scripts/powerups-directory/directory-state.ts` | Pure functions: filter, sort, paginate |
| `src/scripts/powerups-directory/render-directory.ts` | DOM renderers: cards, pager, counts, loading/error/empty states |
| `src/scripts/powerups-directory/index.ts` | Bootstrap + event wiring |
| `src/scripts/powerup-view/extract-tarball.ts` | fflate gunzip + USTAR walker → `Map<filePath, content>` |
| `src/scripts/powerup-view/fetch-package-detail.ts` | Registry metadata fetch, tarball fetch, instructions parsing |
| `src/scripts/powerup-view/render-package-view.ts` | DOM renderers for the detail page |

### Principles

- Vanilla TypeScript, no framework islands; Astro bundles scripts referenced from the pages.
- Logic lives in pure, unit-testable functions; DOM renderers stay thin.
- Follow repo conventions: multi-parameter functions take object parameters, descriptive names, spaces around operators.

## 4. Directory page (`/powerups/`)

### Layout (top → bottom)

1. **Header row** — `h1` "All powerups" (left); result range (right): `${firstIndex}-${lastIndex} / ${total}` where `total` is the filtered result count and `firstIndex`/`lastIndex` describe the current page slice (e.g. `1-50 / 3002`). The range region is `aria-live="polite"`.
2. **Toolbar** — search input (placeholder "Search powerups…", sr-only label, search icon), sort `<select>` (options: "Most downloads" [default], "Recently published", "Ascending", "Descending"), **Search** button (primary), **Clear** button (subtle).
   - ≥ 768px: all controls on one line; the search input flexes to fill remaining space.
   - < 768px: search input full-width on its own line; sort + Search + Clear wrap onto the next line, with spacing below before the grid.
3. **Card grid** — CSS grid `repeat(auto-fill, minmax(280px, 1fr))`. Each card (rich-metadata design):
   - Name row: full package name (wraps, breaks on hyphens) + npm / GitHub quick links when those links exist.
   - Description.
   - Meta row: publisher avatar (first letter) + username, version chip, formatted downloads (`257 dl/mo`, `12.4k dl/mo`, `1.2M dl/mo`).
   - The whole card links to `/powerups/view?package=<encoded name>` (scoped names URL-encoded).
4. **Pagination** — numbered pager centered under the grid: prev chevron, page numbers with ellipsis for long ranges, next chevron; current page highlighted. Hidden when there is only one page.
5. **States**
   - Loading: skeleton cards.
   - Fetch error: error panel with a Retry button (retry clears the cache and refetches).
   - Empty results: "No powerups found for '<query>'" panel.

### Behaviors

- **On load:** fetch the npm search API in 250-result pages (`from=0,250,500…`) sequentially until a page returns fewer than 250 objects (safety cap: 40 pages). The first response's `total` validates exhaustion. The normalized list caches to `sessionStorage` (`powerups-directory-cache-v1`) so back/forward navigation does not refetch.
- **Sort select:** applies instantly and resets to page 1.
- **Search button:** applies the query — case-insensitive substring match on name, description, and keywords — and resets to page 1. Pressing Enter in the input behaves like clicking Search.
- **Clear button:** empties the query, restores the default sort, resets to page 1.
- Header count and pager recompute on every state change; only the current 50-card slice renders.

### Sorting

| Option | Key |
| --- | --- |
| Most downloads (default) | monthly downloads, descending |
| Recently published | publish date, descending |
| Ascending | package name, ascending (locale-aware) |
| Descending | package name, descending |

## 5. Detail page (`/powerups/view?package=<name>`)

### Data flow

1. Read the `package` query param. Missing → friendly error panel with a link back to `/powerups/`.
2. `GET https://registry.npmjs.org/<encoded name>` → packument. Resolve `dist-tags.latest`; read description, license, publisher, links, and `versions[latest].dist.tarball`.
3. `GET` the tarball → `ArrayBuffer` → `extractTarball()` (fflate `gunzipSync` + USTAR walker) → `Map<filePath, content>`.
4. Parse `dist/instructions.json` (the compiled instructions published inside the tarball).
5. Resolve template files: each `create`/`modify` step's `template` value (e.g. `src/index.ts`) maps to extracted file `dist/<template>`; unique files feed the Template files section.

### Layout (per approved option C)

1. Back link: "← All powerups".
2. **Header**: package name, description, chips (version, type badge `single-use`/`multi-use`, license, "by <publisher>"), install command `pup install <name>` in a copyable code block, npm/repository links.
3. **Variables block**: required and optional variables with defaults; empty state "No variables required".
4. **Intent block**: the instructions' `intent` lines (when present).
5. **Steps section** (summary only, no inline code): one card per step — type badge (`create` green, `modify` amber, `delete` red, `read` slate, `install` indigo), step name, target path (`outputPath`, or dependencies for install steps), and "from <template>" when the step references a template.
6. **Template files section**: filename tab bar (unique template files referenced by the steps) + a plain styled `<pre><code>` panel; switching tabs swaps the panel content. Template files are TypeScript modules (`export default function (variables) { … }`) that return the file contents — displayed as-is.

### Error states

- Package not found / fetch failure → error panel with retry + back link.
- Tarball without `dist/instructions.json` → show metadata + "This powerup hasn't published viewable instructions."

## 6. Data layer

### npm endpoints (all CORS-enabled)

- Search: `https://registry.npmjs.org/-/v1/search?text=keywords:powerups-package&size=250&from=<offset>` → `{ total, objects: [...] }`
- Packument: `https://registry.npmjs.org/<encoded package name>`
- Tarball: URL taken from the packument (`dist.tarball`)

### Types

```ts
interface PowerupSummary {
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

type DirectorySort = "most-downloads" | "recently-published" | "name-asc" | "name-desc";

/* Field mapping from the npm search API response:
   publishedAt      <- package.date
   updatedAt        <- top-level updated
   monthlyDownloads <- downloads.monthly
   publisherUsername<- package.publisher.username
   npmUrl           <- package.links.npm, repositoryUrl <- package.links.repository */

interface DirectoryState {
  query: string;
  sort: DirectorySort;
  page: number;
}

interface PowerupInstructions {
  name: string;
  type: "multi-use" | "single-use";
  description: string;
  variables: {
    required: string[];
    optional?: string[];
    defaults?: Record<string, string>;
  };
  intent: string[];
  steps: PowerupStep[];
}
```

`PowerupStep` mirrors the SDK's step union (`packages/sdk/src/private/schema/instructions.ts`): `create`/`modify` (template, outputPath), `delete` (outputPath), `read` (path, as), `install` (dependencies, packageManager). The view page treats it as untrusted data and renders defensively — unknown step types render a neutral badge.

### Pure functions (unit-testable)

```ts
function normalizeSearchObject({ searchObject }: { searchObject: NpmSearchObject }): PowerupSummary;

function filterPowerups({ powerups, query }: { powerups: PowerupSummary[]; query: string }): PowerupSummary[];

function sortPowerups({ powerups, sort }: { powerups: PowerupSummary[]; sort: DirectorySort }): PowerupSummary[];

function paginatePowerups({ powerups, page, pageSize }: {
  powerups: PowerupSummary[];
  page: number;
  pageSize: number;
}): { slice: PowerupSummary[]; total: number; firstIndex: number; lastIndex: number };
```

`PAGE_SIZE = 50`.

## 7. Tarball extraction

- `fflate.gunzipSync` decompresses the response (dependency: `fflate`, ~8 KB gzipped — the only new dependency).
- USTAR walker: iterate 512-byte headers; read name (offset 0, 100 bytes), size (offset 124, 12 bytes octal), typeflag (offset 156), and prefix (offset 345, 155 bytes) for long paths; file content follows, padded to the 512-byte boundary. Regular files only, decoded as UTF-8.
- Strip the leading `package/` segment so keys match paths like `dist/instructions.json` and `dist/src/index.ts`.
- Unit tested against the real published tarball.

## 8. Starlight components used

- `StarlightPage` — both page shells (keeps nav, footer, and theme).
- Sort dropdown — Starlight's `Select` component if an icon from its set fits; otherwise a native `<select>` styled to match via `custom.css`.
- The header count row, toolbar, cards, pager, and detail layout are custom markup (Starlight's `Pagination` is doc prev/next, not list pagination; `PageTitle` doesn't combine a title with a right-aligned counter).

## 9. Testing

- **Vitest unit tests** for pure modules: `directory-state` (filter/sort/paginate), `fetch-powerups` normalization (fixture search JSON), `extract-tarball` (real sample tarball fixture), instructions parsing (valid + malformed fixtures).
- **Manual verification** in `astro dev`: desktop/mobile toolbar wrapping, sort/search/clear interactions, pagination, empty/error states, detail page with the real `@liolocs/powerup-hello-world` package.

## 10. Out of scope / future

- Server-rendered detail pages for SEO (revisit if needed).
- Longer-lived download-count caching beyond `sessionStorage`.
- Version selection (always shows the latest version), download charts, category/tag filters.
