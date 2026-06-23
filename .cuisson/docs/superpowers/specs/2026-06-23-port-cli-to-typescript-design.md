# Port Go CLI to TypeScript (r-cli)

## Overview

Port all functionality from `cli/` (Go/Cobra) to `r-cli/` (TypeScript/Bun), with these key changes:
- Templates use `.ts` files exporting `function(vars) => string` instead of `.tmpl` with Go template syntax
- Nunjucks templates (`.njk`) remain supported as an alternative
- All I/O uses `@rcompat/*` packages for runtime agnosticism
- Local-first architecture: `.templates/` folder in the project root, no global `~/.cuisson`

## Architecture & Directory Structure

```
r-cli/
├── index.ts                    # Entry point (already exists)
├── package.json                # Dependencies (@rcompat/*, nunjucks, proby)
├── cmd/                        # CLI command handlers (auto-discovered via cmd/index.ts)
│   ├── index.ts               # Dynamic import discovery of all .ts files in cmd/
│   ├── init.ts                # Initialize .templates/ in current project
│   ├── launch.ts              # Launch a recipe by name
│   ├── generate-recipe.ts     # Generate recipe from detected cluster
│   ├── detect-patterns.ts     # Scan project for patterns, cluster files
│   ├── recipes/               # Parent command group
│   │   ├── list.ts            # List all available recipes in .templates/recipes/
│   │   ├── search.ts          # Search by intent keyword overlap
│   │   └── validate.ts        # Validate recipe composition
│   └── metrics/               # Parent command group
│       └── summary.ts         # Show aggregated launch metrics
├── lib/                        # Core logic (replaces internal/* from Go CLI)
│   ├── cli.ts                 # Commander-like API built on @rcompat/cli
│   ├── project.ts             # Project root discovery (.templates/ walk-up)
│   ├── discover.ts            # Recipe discovery (scan .templates/recipes/ for recipe.json)
│   ├── render.ts              # Template rendering engine (.ts + .njk)
│   ├── variables.ts           # Variable parsing, prompting, resolution
│   ├── composition.ts         # Recipe extends/children tree resolution (pre-order DFS)
│   ├── metrics.ts             # Metrics logging (JSONL) and aggregation
│   ├── patterns.ts            # Pattern store read/write (.templates/patterns.json)
│   ├── detect.ts              # Tokenization, clustering, skeleton extraction
│   └── search.ts              # Intent-based recipe search
├── utils/                      # Shared utilities (already partially exists)
│   └── filesystem/            # createFile, fileExists, importFile, getProjectRoot
└── docs/                      # Design specs (already exists)
```

## Key Design Decisions

### 1. Local-First Architecture & Project Management

No more global `~/.cuisson/projects/`. Everything lives in `.templates/` relative to the project root.

**Project root discovery:**
- Walk up from CWD looking for `.templates/` directory (replaces `cuisson.config.json` discovery)
- The first `.templates/` found becomes the project root — all template reads, metrics writes, and pattern storage are relative to it

**`init` command:**
- Creates `.templates/recipes/.gitkeep` (nested so both directories are created and tracked)
- Creates `.templates/metrics.jsonl` (empty, for appending)
- Prints confirmation: `[+] Initialized .templates/ in <path>`

**Storage layout:**
```
my-project/
├── .templates/                    # ← committed with codebase (project root)
│   ├── recipes/                   # Recipe directories live here
│   │   ├── new-component/         # One dir per recipe
│   │   │   ├── recipe.json        # Recipe definition
│   │   │   └── index.ts           # Template file (function(vars) => string)
│   │   └── new-store/
│   │       ├── recipe.json
│   │       └── store.ts
│   ├── metrics.jsonl              # Launch history (JSON lines)
│   └── patterns.json              # Detected pattern clusters
├── src/
```

**Paths:**
- Templates: `<project-root>/.templates/recipes/<recipe-name>/`
- Metrics: `<project-root>/.templates/metrics.jsonl`
- Patterns: `<project-root>/.patterns.json`

**Removed commands:** `project create/list/delete/info` — replaced by single `init`. No global project registry.

### 2. Commander-Like API (built on @rcompat/cli)

A fluent command-definition API built on top of `@rcompat/cli` for output formatting. This will serve as inspiration when the CLI package itself is improved with program functionality.

```typescript
import { program } from "../lib/cli.js";

program.command("launch <recipe-name>")
  .description("Launch a recipe by name")
  .option("-v, --var <key=value>", "variable in key=value format (repeatable)")
  .action(async ({ recipeName, var: vars }) => { ... });

program.command("init")
  .description("Initialize .templates/ in current project")
  .action(async () => { ... });

await program.parse();
```

**Features:**
- Command chaining: `.command("name").description(...).option(...).action(fn)`
- Subcommand groups: `program.command("recipes").addCommand(listCmd).addCommand(searchCmd)`
- Option parsing: short/long flags, repeatable options (`--var` can be specified multiple times), required options
- Argument parsing: positional args with `<required>` and `[optional]` syntax
- Help generation: automatic help text from descriptions, options, and usage patterns
- Error handling: invalid commands show available commands list

**Implementation:** `lib/cli.ts` — the program builder (fluent API, command registration, parsing). Uses `@rcompat/cli` for output formatting, `@rcompat/io` for stdin/stdout access and interactive prompting, `@rcompat/runtime` for process args and exit.

### 3. Template Rendering Engine (lib/render.ts)

Two template formats, selected by file extension:

**TypeScript templates (.ts)** — the new default:
- Template file exports a function: `export default (vars) => string`
- Recipe.json references it as `"template": "index.ts"`
- At render time: `import { default } from "./recipe-dir/index.ts"` → call with variables map → get rendered string
- Variables are passed as `{ [key: string]: string }`

**Nunjucks templates (.njk)** — supported as alternative:
- Template file uses `{{ variable }}` syntax (not Go template `{{.variable}}`)
- Recipe.json references it as `"template": "index.ts.njk"` (extension determines renderer)
- At render time: `nunjucks.render("index.ts.njk", variables)`

**Shared behavior for both:**
- Output path resolution: replace `{{var}}` patterns in the outputPath field with variable values
- Strcase transformations available to both renderers: `camelCase`, `PascalCase`, `snake_case`, `kebabCase`
- File write: skip if file already exists, create parent dirs as needed
- Uses `@rcompat/fs` for all filesystem operations

**Example recipe.json:**
```json
{
  "name": "new-component",
  "variables": ["componentName"],
  "intent": ["create a new component"],
  "output": {
    "files": [
      {
        "name": "index.ts",
        "template": "index.ts",
        "outputPath": "src/lib/components/{{componentName}}/index.ts"
      }
    ]
  }
}
```

**Corresponding template `index.ts`:**
```typescript
export default (vars: Record<string, string>) => {
  return `export { default } from "./${vars.componentName}.svelte";\n`;
};
```

### 4. Recipe Composition (lib/composition.ts)

Port the pre-order DFS composition tree resolution from `cli/internal/render/recipe.go`. This handles:
- Parent recipe → child recipes via `extends` field in recipe.json
- Variable mapping between parent and child (`map` field)
- Recursive resolution of transitive children

### 5. Pattern Detection Pipeline (lib/detect.ts)

Two-phase pipeline (tree-sitter refinement deferred):
- **Phase 1 — Tokenization**: Strip comments (single-line `//` and multi-line `/* */`), replace string/number literals with `__STR__`/`__NUM__`, tokenize into keywords/identifiers/operators, generate 3-gram shingles
- **Phase 2 — Clustering**: Compute Jaccard similarity between all file pairs, union-find grouping with configurable threshold (default 0.7), minimum cluster size (default 2)

Output written to `.templates/patterns.json` with clusters containing file paths, inferred skeleton templates, and slot names.

### 6. Metrics (lib/metrics.ts)

Port the JSONL-based metrics logging:
- Log per-launch: recipe name, input chars, output files (path/chars/written)
- Aggregate per-project: launches, total input/output chars, estimated tokens saved
- Discover projects by looking for `.templates/metrics.jsonl`

## Command Mapping (Go → TypeScript)

| Go CLI | TypeScript r-cli | Notes |
|--------|-----------------|-------|
| `project create` | **`init`** | Creates `.templates/`, no global state |
| `project list` | **Removed** | No global project registry |
| `project delete` | **Removed** | No global project registry |
| `project info` | **Removed** | No global project registry |
| `launch <name>` | `launch <name>` | Same behavior, local `.templates/` |
| `generate-recipe <id>` | `generate-recipe <id>` | Writes to `.templates/recipes/` by default |
| `detect-patterns` | `detect-patterns` | Writes to `.templates/patterns.json` |
| `recipes list` | `recipes list` | Scans `.templates/recipes/` |
| `recipes search --intent "..."` | `recipes search --intent "..."` | Same behavior |
| `recipes validate [name]` | `recipes validate [name]` | Same behavior |
| `metrics summary [--project]` | `metrics summary [--project]` | Reads from `.templates/metrics.jsonl` |

## Final Command List

| Command | File | Description |
|---------|------|-------------|
| `init` | `cmd/init.ts` | Create `.templates/recipes/.gitkeep` + empty metrics.jsonl |
| `launch <name>` | `cmd/launch.ts` | Launch recipe, resolve vars, render templates to output dir |
| `generate-recipe <id>` | `cmd/generate-recipe.ts` | Generate recipe from detected cluster in patterns.json |
| `detect-patterns` | `cmd/detect-patterns.ts` | Scan source files, cluster by similarity, write patterns.json |
| `recipes list` | `cmd/recipes/list.ts` | List all recipes in `.templates/recipes/` |
| `recipes search --intent "..."` | `cmd/recipes/search.ts` | Search recipes by keyword overlap on intent |
| `recipes validate [name]` | `cmd/recipes/validate.ts` | Validate composition (circular deps, missing vars, duplicate paths) |
| `metrics summary [--project]` | `cmd/metrics/summary.ts` | Show aggregated launch metrics from metrics.jsonl |

## Internal Library Modules (lib/)

- `cli.ts` — Commander-like API built on @rcompat/cli
- `project.ts` — Project root discovery (walk up for `.templates/`)
- `discover.ts` — Scan `.templates/recipes/` for recipe.json files
- `render.ts` — Template rendering (.ts functions + .nunjucks)
- `variables.ts` — Parse --var flags, prompt for missing vars
- `composition.ts` — Resolve extends/children tree (pre-order DFS)
- `metrics.ts` — JSONL logging and aggregation
- `patterns.ts` — Read/write `.templates/patterns.json`
- `detect.ts` — Tokenization + clustering pipeline
- `search.ts` — Intent keyword overlap scoring

## Template File Naming

- `.ts` templates: `"template": "index.ts"` in recipe.json → `recipes/new-component/index.ts`
- `.njk` templates: `"template": "index.ts.njk"` in recipe.json → `recipes/new-component/index.ts.njk`

## Output Directory for detect-patterns

Auto-detected from project root (`.templates/`). The command scans the project's source directory — by default it walks up from CWD to find `.templates/`, then scans the sibling source directories (e.g., `src/`). This can be overridden with a `--output-dir` flag.

## What's Included vs. Deferred

**Included (must-have):**
- All command groups: `init`, `launch`, `generate-recipe`, `detect-patterns`, `recipes list/search/validate`, `metrics summary`
- Recipe discovery, variable resolution, template rendering (.ts + .njk), composition tree
- Pattern detection (tokenization + clustering)
- Recipe generation from clusters, intent search, composition validation

**Deferred (nice-to-have):**
- Tree-sitter AST-based skeleton refinement (`--refine` flag) — requires WASM build
- Metrics summary table formatting (can use simple console.table initially)
