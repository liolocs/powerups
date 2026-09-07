# Doc Page Prev/Next Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add previous/next page navigation links to the bottom of each docs page, using the same ordering as the sidebar.

**Architecture:** A new `getPrevNextPages` function in `buildDocsNav.ts` reuses the existing sorted nav tree, flattens it depth-first into a page-only list, and returns the prev/next neighbors of the current page. A new `PageBottomLinks.astro` presentational component renders the links. The `[...page].astro` page wires them together.

**Tech Stack:** Astro, TypeScript, Tailwind CSS, `astro:content` collection API.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/layouts/docs-layout/buildDocsNav.ts` | Modify | Add `getPrevNextPages` function that flattens the nav tree and returns prev/next |
| `src/components/pages/PageBottomLinks.astro` | Create | Presentational component rendering prev/next link row |
| `src/pages/docs/[...page].astro` | Modify | Wire up `getPrevNextPages` and render `PageBottomLinks` |

---

### Task 1: Add `getPrevNextPages` to `buildDocsNav.ts`

**Files:**
- Modify: `src/layouts/docs-layout/buildDocsNav.ts` (append after the `buildDocsNav` function)

- [ ] **Step 1: Add the `getPrevNextPages` function**

Append this function at the end of `src/layouts/docs-layout/buildDocsNav.ts`, after the `buildDocsNav` function:

```ts
// Flatten the sorted nav tree into a depth-first list of page nodes only.
// Folders are skipped — their `url` resolves to a child page that already
// appears in the list. The resulting order matches the sidebar's reading order.
const flattenPages = (nodes: NavNode[]): NavPage[] => {
  const pages: NavPage[] = []
  for (const node of nodes) {
    if (node.kind === "page") {
      pages.push(node)
    } else {
      pages.push(...flattenPages(node.children))
    }
  }
  return pages
}

// Return the previous and next pages relative to `currentPath`, using the same
// sorted tree the sidebar renders. Returns `{ prev: null, next: null }` if the
// current page isn't found. `prev` is null on the first page; `next` is null on
// the last page.
export async function getPrevNextPages(
  currentPath: string
): Promise<{ prev: NavPage | null; next: NavPage | null }> {
  const nav = await buildDocsNav(currentPath)
  const flat = flattenPages(nav)
  const index = flat.findIndex((page) => page.isActive)
  if (index === -1) return { prev: null, next: null }
  return {
    prev: flat[index - 1] ?? null,
    next: flat[index + 1] ?? null,
  }
}
```

- [ ] **Step 2: Run typecheck to verify it compiles**

Run: `pnpm typecheck`
Expected: PASS with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/docs-layout/buildDocsNav.ts
git commit -m "feat: add getPrevNextPages function to buildDocsNav"
```

---

### Task 2: Create `PageBottomLinks.astro`

**Files:**
- Create: `src/components/pages/PageBottomLinks.astro`

- [ ] **Step 1: Create the component file**

Create `src/components/pages/PageBottomLinks.astro` with this content:

```astro
---
import type { NavPage } from "@/layouts/docs-layout/buildDocsNav"

interface Props {
  prev: NavPage | null
  next: NavPage | null
}

const { prev, next } = Astro.props
---

{(prev || next) && (
  <div class="flex justify-between gap-4 pt-8 mt-8 border-t border-border w-full">
    {prev ? (
      <a
        href={prev.url}
        class="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>←</span>
        <span>{prev.title}</span>
      </a>
    ) : (
      <span />
    )}
    {next ? (
      <a
        href={next.url}
        class="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
      >
        <span>{next.title}</span>
        <span>→</span>
      </a>
    ) : (
      <span />
    )}
  </div>
)}
```

- [ ] **Step 2: Run typecheck to verify it compiles**

Run: `pnpm typecheck`
Expected: PASS with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pages/PageBottomLinks.astro
git commit -m "feat: add PageBottomLinks component for prev/next navigation"
```

---

### Task 3: Wire up `getPrevNextPages` and `PageBottomLinks` in `[...page].astro`

**Files:**
- Modify: `src/pages/docs/[...page].astro`

- [ ] **Step 1: Update the frontmatter imports and add the prev/next call**

Replace the entire frontmatter section of `src/pages/docs/[...page].astro` with:

```astro
---
import { getCollection, render } from 'astro:content';
import { getPrevNextPages } from "@/layouts/docs-layout/buildDocsNav"
import DocsLayout from "@/layouts/docs-layout/docs-layout.astro"
import PageHeader from '@/components/pages/PageHeader.astro';
import PageBottomLinks from '@/components/pages/PageBottomLinks.astro';

export async function getStaticPaths() {
  const pages = await getCollection('docs');

  return pages.map(page => ({
    params: { page: page.id },
    props: { page },
  }));
}

const { page } = Astro.props;
const { Content } = await render(page);
const { prev, next } = await getPrevNextPages(`/docs/${page.id}`);
---
```

- [ ] **Step 2: Add `PageBottomLinks` to the template**

Replace the template body of `src/pages/docs/[...page].astro` with:

```astro
<DocsLayout>
    <PageHeader title={page.data.title} description={page.data.description} />
    <div class="prose w-full" >
        <Content />
    </div>
    <PageBottomLinks prev={prev} next={next} />
</DocsLayout>
```

- [ ] **Step 3: Run typecheck to verify it compiles**

Run: `pnpm typecheck`
Expected: PASS with no errors.

- [ ] **Step 4: Run the build to verify everything works end-to-end**

Run: `pnpm build`
Expected: Build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/docs/[...page].astro
git commit -m "feat: wire up prev/next navigation links on doc pages"
```