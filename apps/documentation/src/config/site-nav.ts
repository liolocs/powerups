import type { NavNode, NavFolder } from "@/layouts/docs-layout/buildDocsNav"

export interface TopLink {
  label: string
  href: string
  order?: number
  // e.g. "_blank" to open in a new tab.
  target?: string
}

// Manually-declared standalone pages (not part of the docs collection).
// The page file need not exist yet; this just reserves the nav slot.
export const manualTopLinks: TopLink[] = [
  { label: "Powerups", href: "/powerups" },
]

const linkOrder = (link: { order?: number }): number => link.order ?? Infinity

// Build the site's top-level nav: each top-level docs folder becomes a link
// (to its resolved first page, via `resolveFolderUrls` in buildDocsNav),
// merged with the manual entries and sorted by `order` (folders inherit the
// min child order), ties broken alphabetically by label.
export function buildTopLinks(navMain: NavNode[]): TopLink[] {
  const folderLinks: TopLink[] = navMain
    .filter((n): n is NavFolder => n.kind === "folder")
    .map((n) => ({ label: n.title, href: n.url, order: n.order }))
  return [...folderLinks, ...manualTopLinks].sort((a, b) => {
    const diff = linkOrder(a) - linkOrder(b)
    return diff !== 0 ? diff : a.label.localeCompare(b.label)
  })
}