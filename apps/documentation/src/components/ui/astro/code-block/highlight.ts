import {
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
} from "shiki"
import bashLang from "shiki/dist/langs/bash.mjs"
import tsLang from "shiki/dist/langs/typescript.mjs"
import tsxLang from "shiki/dist/langs/tsx.mjs"
import jsoncLang from "shiki/dist/langs/jsonc.mjs"
import jsonLang from "shiki/dist/langs/json.mjs"
import shellLang from "shiki/dist/langs/shellscript.mjs"
import yamlLang from "shiki/dist/langs/yaml.mjs"
import pythonLang from "shiki/dist/langs/python.mjs"
import mdxLang from "shiki/dist/langs/mdx.mjs"
import mdLang from "shiki/dist/langs/markdown.mjs"

// ─── Types ───────────────────────────────────────────────────────────────────

export type CodeBlockFile = {
  filename: string
  code: string
  language?: BundledLanguage
  panelClassName?: string
  paneStyle?: Record<string, string>
  highlightLines?: number[]
  highlightClassName?: string
  showLineNumbers?: boolean
  autoHeight?: boolean
}

// ─── Highlighting (build-time) ───────────────────────────────────────────────

// Statically imported language registrations to avoid dynamic-import chunk issues
const PRELOADED_LANGS = [
  bashLang,
  tsLang,
  tsxLang,
  jsoncLang,
  jsonLang,
  shellLang,
  yamlLang,
  pythonLang,
  mdxLang,
  mdLang,
]
const PRELOADED_LANG_IDS = new Set(
  PRELOADED_LANGS.flatMap((l) =>
    (l as unknown as { id: string; aliases?: string[] }[])
      .map((r) => [r.id, ...(r.aliases ?? [])])
      .flat(),
  ),
)

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: PRELOADED_LANGS as never,
    })
  }
  return highlighterPromise
}

export async function highlight(
  code: string,
  lang: BundledLanguage = "tsx",
): Promise<string> {
  try {
    const highlighter = await getHighlighter()
    if (!PRELOADED_LANG_IDS.has(lang)) {
      await highlighter.loadLanguage(lang as never)
    }
    return highlighter.codeToHtml(code, {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
    })
  } catch {
    // Fallback: wrap in plain-text pre/code so the UI never breaks
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
    return `<pre><code>${escaped}</code></pre>`
  }
}

/** Extract the individual line HTML from a Shiki `codeToHtml` result. */
export function splitShikiLines(html: string): string[] {
  const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)
  if (!match) return [html]

  const lines = match[1].split("\n")
  // Drop trailing empty element produced by the closing newline
  if (lines[lines.length - 1] === "") lines.pop()

  return lines
}

/**
 * Build the inner HTML for a code pane, supporting both the simple
 * (single-block) view and the line-by-line view (line numbers / highlights).
 */
export function buildPaneInner(
  file: Pick<
    CodeBlockFile,
    | "code"
    | "highlightLines"
    | "highlightClassName"
    | "showLineNumbers"
  >,
  html: string,
  lines: string[],
): string {
  const hasHighlights = !!(
    file.highlightLines && file.highlightLines.length > 0
  )
  const useLineView = hasHighlights || file.showLineNumbers
  const highlightCls =
    file.highlightClassName ?? "bg-amber-600/40 dark:bg-amber-400/40"

  if (useLineView) {
    const lineEls = lines
      .map((line, i) => {
        const lineNumber = i + 1
        const isHighlighted = file.highlightLines?.includes(lineNumber) ?? false
        const lineNumHtml = file.showLineNumbers
          ? `<span class="text-muted-foreground/50 mr-4 w-4 shrink-0 text-right font-mono text-xs leading-relaxed select-none">${lineNumber}</span>`
          : ""
        const cls = isHighlighted ? highlightCls : ""
        return `<div class="flex items-stretch px-4 py-[0.5px]${cls ? " " + cls : ""}">${lineNumHtml}<span class="flex-1">${line || "&nbsp;"}</span></div>`
      })
      .join("")

    return `<pre class="shiki bg-transparent! p-0 font-mono text-sm leading-relaxed"><code class="block w-max min-w-full">${lineEls}</code></pre>`
  }

  return `<div class="cn-code-block-highlight [&>pre]:p-4 [&>pre]:text-sm [&>pre]:leading-relaxed [&>pre]:bg-transparent! [&>pre]:font-mono [&>pre]:whitespace-pre">${html}</div>`
}