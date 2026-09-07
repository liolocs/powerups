# Doc Page Prev/Next Navigation

## Goal

Add previous/next page navigation links to the bottom of each docs page, so readers can move sequentially through the documentation in the same order the sidebar presents it.

## Context

The docs site already builds a sorted nav tree via `buildDocsNav(currentPath)` in `src/layouts/docs-layout/buildDocsNav.ts`. This tree is used by the sidebar and header. Individual doc pages are rendered by `src/pages/docs/[...page].astro`, which currently has no awareness of sibling pages.

## Design

### `getPrevNextPages` — new function in `buildDocsNav.ts`

```ts
export async function getPrevNextPages(
  currentPath: string
): Promise<{ prev: NavPage | null; next: NavPage | null }>
```

**Logic:**

1. Call `buildDocsNav(currentPath)` to get the sorted `NavNode[]` tree.
2. Depth-first walk the tree, collecting only `NavPage` nodes into a flat array. Folders are skipped — they aren't pages; their `url` resolves to their first child page, which will already appear in the flat list as a page node.
3. Find the index of the current page (the node where `isActive === true`).
4. Return `{ prev: flatList[i - 1] ?? null, next: flatList[i + 1] ?? null }`.
5. If the current page isn't found, return `{ prev: null, next: null }`.

This reuses the exact same ordering the sidebar uses, so prev/next matches what users see in the nav.

### `PageBottomLinks.astro` — new component in `src/components/pages/`

A presentational component that receives prev/next data as props and renders the link row. No data logic — purely presentational.

**Props:**

```ts
interface Props {
  prev: NavPage | null
  next: NavPage | null
}
```

**Template:**

- A flex row (`justify-between`) with a top border separator, rendered only when at least one of `prev` or `next` is non-null.
- Left side: previous page link (`← {prev.title}`) or an empty spacer `<span />` if `prev` is null.
- Right side: next page link (`{next.title} →`) or an empty spacer `<span />` if `next` is null.
- Spacers keep the layout balanced when only one side has a link.

### `[...page].astro` — wiring

In the frontmatter:

- Import `getPrevNextPages` and `PageBottomLinks`.
- Compute `currentPath` as `/docs/${page.id}` (matching the URL format used in `buildDocsNav`).
- Call `const { prev, next } = await getPrevNextPages(currentPath)`.

In the template, render `<PageBottomLinks prev={prev} next={next} />` after the `<Content />` div, inside `<DocsLayout>`.

## Edge Cases

- **First page** (e.g., first guides page): `prev` is `null` → only "Next →" link shows; left side is a spacer.
- **Last page** (e.g., SDK page): `next` is `null` → only "← Previous" link shows; right side is a spacer.
- **Current page not found in collection**: both `prev` and `next` are `null` → the entire row is not rendered.

## Files Touched

1. `src/layouts/docs-layout/buildDocsNav.ts` — add `getPrevNextPages` function.
2. `src/components/pages/PageBottomLinks.astro` — new file.
3. `src/pages/docs/[...page].astro` — wire up the function and component.