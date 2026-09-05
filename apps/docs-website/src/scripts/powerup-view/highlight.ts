import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("markdown", markdown);

/** Escape HTML entities for the fallback path. */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/** Highlight `code` as `lang`, falling back to auto-detection, then to escaped plain text. */
export function highlightCode(code: string, lang: string): string {
    try {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
    } catch {
        // fall through to auto-detect
    }
    try {
        return hljs.highlightAuto(code).value;
    } catch {
        return escapeHtml(code);
    }
}

/** Detect the highlight.js language name from a file path extension. */
export function detectLang(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "ts":
        case "mts":
        case "cts":
            return "typescript";
        case "js":
        case "mjs":
        case "cjs":
            return "javascript";
        case "json":
            return "json";
        case "sh":
        case "bash":
            return "bash";
        case "yml":
        case "yaml":
            return "yaml";
        case "md":
        case "markdown":
            return "markdown";
        default:
            return "typescript";
    }
}