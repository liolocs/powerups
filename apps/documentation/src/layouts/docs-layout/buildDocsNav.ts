import { getCollection } from "astro:content"

// Shared nav-tree types for the docs sidebar / mobile drawer.
export interface NavPage {
  kind: "page"
  title: string
  url: string
  order?: number
  isActive: boolean
}

export interface NavFolder {
  kind: "folder"
  name: string
  title: string
  url: string
  order?: number
  children: NavNode[]
}

export type NavNode = NavPage | NavFolder

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Folder display titles. Defaults to the capitalized folder name; override
// here for acronyms or custom labels (e.g. "cli" -> "CLI").
const folderTitles: Record<string, string> = {
  cli: "CLI",
}
const titleForFolder = (name: string) => folderTitles[name] ?? capitalize(name)

// `order` controls the position of a page within its group. Pages without an
// explicit order sink to the bottom, tie-broken alphabetically by title.
// Folders inherit the minimum order of their children.
const nodeOrder = (node: NavNode): number =>
  node.kind === "page"
    ? node.order ?? Infinity
    : node.children.length
      ? Math.min(...node.children.map(nodeOrder))
      : Infinity

const sortChildren = (folder: NavFolder) => {
  folder.children.sort((a, b) => {
    const diff = nodeOrder(a) - nodeOrder(b)
    return diff !== 0 ? diff : a.title.localeCompare(b.title)
  })
  for (const child of folder.children) {
    if (child.kind === "folder") sortChildren(child)
  }
}

// Folders don't have a page of their own, so linking to `/docs/<folder>` 404s.
// Resolve each folder's `url` to the first page in its subtree (by sidebar
// `order`, the same ranking used by `sortChildren`) so folder links land on a
// real page. Recurses into sub-folders, so the chosen page is the one that
// sorts first across the whole subtree.
const firstPageUrl = (folder: NavFolder): string | undefined => {
  for (const child of folder.children) {
    if (child.kind === "page") return child.url
    const nested = firstPageUrl(child)
    if (nested) return nested
  }
  return undefined
}

const resolveFolderUrls = (folder: NavFolder) => {
  for (const child of folder.children) {
    if (child.kind === "folder") {
      const first = firstPageUrl(child)
      if (first) child.url = first
      // Stamp the folder's effective order (min child order) so consumers
      // (e.g. buildTopLinks) can sort without re-deriving it.
      child.order = nodeOrder(child)
      resolveFolderUrls(child)
    }
  }
}

// Build the sidebar nav from the `docs` content collection.
// Pages live at arbitrary nesting depths, e.g. `reference/cli/build.md`.
// Each path segment before the file becomes a folder node; the file becomes
// a page node titled from its frontmatter `title`. Folders with sub-folders
// render as collapsible groups (open by default); leaf pages render as links.
export async function buildDocsNav(currentPath: string): Promise<NavNode[]> {
  const pages = await getCollection("docs")

  const root: NavFolder = {
    kind: "folder",
    name: "",
    title: "",
    url: "",
    children: [],
  }

  for (const page of pages) {
    const segments = page.id.split("/")
    const folderSegs = segments.slice(0, -1)
    const url = `/docs/${page.id}`

    const pageNode: NavNode = {
      kind: "page",
      title: page.data.title,
      url,
      order: page.data.sidebar?.order,
      isActive: url === currentPath,
    }

    let current = root
    let accPath: string[] = []
    for (const seg of folderSegs) {
      accPath.push(seg)
      let child = current.children.find(
        (c): c is NavFolder => c.kind === "folder" && c.name === seg
      )
      if (!child) {
        child = {
          kind: "folder",
          name: seg,
          title: titleForFolder(seg),
          url: `/docs/${accPath.join("/")}`,
          children: [],
        }
        current.children.push(child)
      }
      current = child
    }
    current.children.push(pageNode)
  }

  sortChildren(root)
  resolveFolderUrls(root)
  return root.children
}

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