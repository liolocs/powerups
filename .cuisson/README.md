# Cuisson

**Cuisson** (French for "cooking") is a recipe-driven code generator CLI. It uses declarative **recipes** to scaffold and generate project files from templates, with interactive variable prompts and built-in string transformation helpers.

Cuisson also includes a **pattern detection pipeline** that scans your codebase for repetitive file patterns, clusters similar files using token-level analysis and optional tree-sitter AST refinement, and auto-generates recipes from detected clusters.

## Quick Start

### Generate files from existing recipes

```bash
# Install the CLI globally
make install

# Generate a new component (prompts for componentName)
cuisson launch new-component

# Or pass variables inline
cuisson launch new-component --var componentName=MyButton

# Generate a new store
cuisson launch new-store --var storeName=Counter
```

### Detect patterns and generate recipes automatically

```bash
# Scan your codebase for repetitive file patterns
cuisson detect-patterns --threshold 0.7
# → Detects clusters of similar files, writes ~/.cuisson/projects/<project>/patterns.json

# Generate a recipe from a detected cluster
cuisson generate-recipe <cluster-id>
# → Creates recipe.json + .tmpl files in your templates directory

# Search recipes by intent
cuisson recipes search --intent "new base ui component"
# → Finds matching recipes ranked by keyword overlap
```

## Installation

### Via Makefile

From the `cli/` directory:

```bash
# Build and install to ~/.local/bin
make install
```

This will:
1. Compile the Go binary into `../../bin/cuisson`
2. Copy it to `~/.local/bin/cuisson`
3. Add `~/.local/bin` to your shell's PATH (`.bashrc` or `.zshrc`)

Then restart your terminal or run:
```bash
source ~/.zshrc   # or source ~/.bashrc
```

### Other Makefile targets

| Target     | Description                              |
|------------|------------------------------------------|
| `make build`      | Build binary to `../../bin/cuisson`         |
| `make install`    | Build + copy to `~/.local/bin`, update PATH |
| `make test`       | Run all Go tests                          |
| `make clean`      | Remove the built binary                   |

## How It Works

Cuisson has six subcommands: **`launch`** (generate files), **`create`** (scaffold new recipes), **`detect-patterns`** (scan codebase for patterns), **`generate-recipe`** (auto-generate recipes from detected clusters), **`recipes search`** (keyword-based recipe discovery), and **`metrics summary`** (view launch metrics).

### Directory Structure

```
.cuisson/
├── cli/                    # Go CLI source code
│   ├── cmd/                # Cobra commands (root, create, launch,
│   │                       #   detect-patterns, generate-recipe, recipes, metrics)
│   ├── internal/           # Core logic
│   │   ├── discover/       # Scans templates dir for recipe.json files
│   │   ├── detect/         # Pattern detection pipeline (tokenizer, clusterer,
│   │   │                   #   skeleton extraction with tree-sitter)
│   │   ├── patterns/       # Pattern storage (read/write patterns.json)
│   │   ├── recipegen/      # Generates recipes from detected clusters
│   │   ├── recipesearch/   # Keyword-overlap recipe search engine
│   │   ├── render/         # Renders .tmpl files with Go text/template
│   │   └── variables/      # Parses --var flags and prompts for input
│   ├── Makefile            # Build/install targets
│   └── main.go             # Entry point
├── projects/               # Project data (auto-generated)
│   └── <project>/
│       ├── patterns.json   # Cluster data from detect-patterns
│       └── metrics.jsonl   # Launch metrics log
└── templates/              # Recipe definitions and template files
    └── frontend/           # Recipes live in subdirectories
        ├── src/stores/new-store/
        │   ├── recipe.json       # Recipe definition
        │   └── store.ts.tmpl     # Go template file
        └── src/lib/components/new-component/
            ├── recipe.json
            ├── index.ts.tmpl
            └── new-component.svelte.tmpl
```

### Environment Variables

| Variable                | Description                                  | Default              |
|-------------------------|----------------------------------------------|----------------------|
| `CUISSON_TEMPLATES_DIR` | Path to the templates directory              | `.cuisson/templates` |
| `CUISSON_OUTPUT_DIR`    | Project root for output file paths           | Auto-discovered from `cuisson.config.json` |
| `CUISSON_PROJECT_NAME`  | Project name for pattern storage path        | Auto-detected from `cuisson.config.json` |

## The `detect-patterns` Command

Scans your codebase for repetitive file patterns, clusters similar files using token-level analysis (with optional tree-sitter AST refinement), and writes results to `~/.cuisson/projects/<project>/patterns.json`.

```bash
cuisson detect-patterns [--threshold 0.7] [--min-cluster-size 2] [--refine]
```

### Pipeline stages:

1. **Tokenization** (always) — Strips comments, replaces string/number literals with `__STR__`/`__NUM__` placeholders, generates 3-gram token shingles for each file.

2. **Clustering** (always) — Computes Jaccard similarity between all file pairs, applies union-find algorithm with threshold cutoff to form clusters.

3. **Skeleton extraction** (only with `--refine`) — Lazily loads tree-sitter WASM grammars to parse ASTs, aligns structurally equivalent nodes across cluster members, marks divergent positions as slots.

4. **Output** — Writes `~/.cuisson/projects/<project>/patterns.json` and prints a summary to stdout.

### Flags

| Flag                | Default | Description                                          |
|---------------------|---------|------------------------------------------------------|
| `--threshold`       | `0.7`   | Jaccard similarity threshold for clustering (0–1)    |
| `--min-cluster-size`| `2`     | Minimum files per cluster to report                  |
| `--refine, -r`      | `false` | Enable tree-sitter AST refinement for higher precision|

### Example

```bash
# Scan UI components directory
cuisson detect-patterns --threshold 0.5
# → Detected 3 pattern clusters (sidebar-footer, sidebar-menu-sub, ...)

# With tree-sitter refinement for slot inference
cuisson detect-patterns --refine
# → Detects variable slots (e.g., component names, prop types) from AST analysis
```

## The `generate-recipe` Command

Reads a detected cluster from `patterns.json`, extracts skeleton templates with inferred slot names, and writes a recipe directory (`recipe.json` + `.tmpl` files) to your templates folder.

```bash
cuisson generate-recipe <cluster-id> [--output-dir templates/]
```

### What it generates:

For `cuisson generate-recipe ui-component-1`:

```
templates/ui-component-1/
├── recipe.json          # Auto-generated recipe definition with intent
└── component.svelte.tmpl  # Skeleton template with {{SlotName}} placeholders
```

### Intent inference rules:

The generator infers `intent` strings from cluster analysis using four rule categories:

1. **File type keywords** — `.svelte` → "component", `.ts` with `writable`/`derived` → "store"/"state management", barrel exports → "export barrel"
2. **Directory context** — `components/ui/` → "ui component"/"shadcn-style", `stores/` → "store"
3. **Filename patterns** — button/input/sheet names listed as intent keywords
4. **Structural patterns** — files with `<script>` + slots → "base component"/"composable"

### Example

```bash
cuisson generate-recipe ui-component-1 --output-dir .cuisson/templates
# → Recipe generated at templates/ui-component-1/
#     recipe.json: .cuisson/templates/ui-component-1/recipe.json
#     component.svelte.tmpl: .cuisson/templates/ui-component-1/component.svelte.tmpl
```

## The `recipes search` Command

Search all recipes by keyword overlap on their intent descriptions. Returns full recipe content ranked by match relevance, suitable for AI agent consumption.

```bash
cuisson recipes search --intent "<query>" [--limit 5]
```

### How it works:

1. **Query tokenization** — Splits the query into lowercase keywords (handles spaces and common delimiters)
2. **Recipe scoring** — For each recipe, tokenizes all intent strings into a set of tokens and counts how many query keywords appear
3. **Ranking** — Sorts results by score descending, applies `--limit` cap
4. **Output** — Prints human-readable format (including `template_dir`) followed by JSON for machine consumption

### Flags

| Flag              | Default | Description                              |
|-------------------|---------|------------------------------------------|
| `--intent, -i`    | (required) | Search query for intent matching      |
| `--limit, -l`     | `5`     | Maximum number of results to return      |

### Example

```bash
cuisson recipes search --intent "new base ui component"
# → [1] new-component (score: 4, files: 2)
#       template_dir: .cuisson/templates/frontend/src/lib/components/new-component
#       intent: "create a base ui component"
#       intent: "shadcn-style components"

# JSON output for programmatic use (includes template_dir)
cuisson recipes search --intent "store" --limit 1
# → Human-readable list + JSON array below (each result has "template_dir" field)
```

## The `recipes validate` Command

Validates recipe composition for circular dependencies, missing references, and variable mismatches.

```bash
cuisson recipes validate [recipe-name]
# No args = validate all recipes
# With name = validate specific recipe and its children
```

Checks performed:
- **Circular dependencies** — DFS with visited tracking; reports the cycle path (e.g., `A → B → A`)
- **Missing child recipes** — `extends[].recipe` references a recipe not found in the discovered set
- **Missing variables** — A child needs a variable that no parent in the chain provides (via direct var or map)
- **Duplicate output paths** — Two recipes in the same composition tree write to the same file (warning)

Example output:
```
$ cuisson recipes validate page
[✓] recipe "page" — no issues found

$ cuisson recipes validate broken-page
[x] recipe "broken-page": unknown recipe "ghost" referenced by "broken-page"
[!] recipe "broken-page": duplicate output path "out/a.txt" — also written by: parent, child
```

## The `metrics summary` Command

Displays aggregated metrics from all recorded cuisson launches. Shows per-recipe statistics including number of launches, input/output character counts, files written, and estimated tokens saved.

```bash
cuisson metrics summary [--project <name>]
```

### How it works:

1. **Discover** — Scans `~/.cuisson/projects/` for all projects with a `metrics.jsonl` file.
2. **Aggregate** — Reads each project's JSONL metrics log, groups by recipe name, and computes totals.
3. **Output** — Prints a formatted table with per-recipe stats and overall totals.

### Flags

| Flag                | Default | Description                              |
|---------------------|---------|------------------------------------------|
| `--project, -p`     | (none)  | Show metrics for a specific project only |

### Example

```bash
cuisson metrics summary
# → Cuisson Metrics — my-project
#    Recipe          Launches   Input Chars   Output Chars   Est Tokens Saved
#    new-component        12       4800          9600           ~2400
#    new-store             8       3200          6400           ~1600
#    ------              ----       ---------     ----------     ----------------
#    Total                20       8000         16000           ~4000

cuisson metrics summary --project my-project
# → Shows metrics for a single project only
```

## The `launch` Command

The `launch` command reads a recipe, resolves its variables (via flags or interactive prompts), and renders the template files to your project.

```bash
cuisson launch <recipe-name> [--var key=value ...]
```

### How it works step by step:

1. **Discover** — Scans `CUISSON_TEMPLATES_DIR` for all `recipe.json` files. Each parent directory name becomes a recipe command (e.g., `.cuisson/templates/frontend/src/stores/new-store/` → `new-store`).

2. **Resolve variables** — Checks for `--var key=value` flags first, then prompts interactively for any missing required variables.

3. **Render templates** — For each file in the recipe's `output.files` list:
   - Reads the `.tmpl` template from the recipe directory
   - Executes it with Go's `text/template`, injecting variable values and helper functions
   - Resolves the output path by replacing `{{varName}}` patterns with actual values
   - Writes the file (skips if it already exists)

### Template helpers

Templates have access to these string transformation functions via Go's `text/template`:

| Function       | Example input     | Output           |
|----------------|-------------------|------------------|
| `camelCase`    | `"my_component"`  | `"myComponent"`  |
| `PascalCase`   | `"my_component"`  | `"MyComponent"`  |
| `snake_case`   | `"MyComponent"`   | `"my_component"` |
| `kebabCase`    | `"MyComponent"`   | `"my-component"` |

Usage in templates:
```go
{{.componentName | PascalCase}}
```

### Example

Given the `new-component` recipe:

```bash
cuisson launch new-component --var componentName=MyButton
```

This produces:
- `frontend/src/lib/components/MyButton/index.ts`
- `frontend/src/lib/components/MyButton/MyButton.svelte`

## The `create` Command

The `create` command scaffolds a new recipe directory with a minimal `recipe.json` listing the required variables.

```bash
cuisson create <recipe-name> --var <variable-name> [--var <another-var>]
```

### What it generates:

For `cuisson create my-service --var serviceName --var baseUrl`:

```
templates/<recipe-name>/
└── recipe.json          # Auto-generated recipe definition with variables
```

The generated `recipe.json`:

```json
{
  "name": "my-service",
  "variables": ["serviceName", "baseUrl"]
}
```

### Workflow for creating recipes:

1. **Scaffold** the recipe structure with variables:
   ```bash
   cuisson create my-api --var apiName --var endpoint
   # → Creates .cuisson/templates/my-api/recipe.json with variables list
   ```

2. **Edit** the `recipe.json` to add output file definitions:
   ```json
   {
     "name": "my-api",
     "variables": ["apiName", "endpoint"],
     "output": {
       "files": [
         {
           "name": "{{apiName}}.ts",
           "template": "index.ts.tmpl",
           "outputPath": "frontend/src/api/{{apiName}}.ts"
         }
       ]
     }
   }
   ```

3. **Create** the `.tmpl` template file(s) with your actual content, using `{{.variableName}}` syntax and optional helper functions.

4. **Launch** the recipe to generate files:
   ```bash
   cuisson launch my-api --var apiName=UserService --var endpoint=/api/users
   ```

## Recipe File Format (`recipe.json`)

```json
{
  "name": "string",              // Recipe display name
  "variables": ["var1", "var2"], // Required variable names (order matters for prompts)
  "intent": ["component", "ui component"], // Keywords for recipe search matching
  "output": {
    "files": [
      {
        "name": "string",         // Human-readable file name
        "template": "file.tmpl",  // Template filename in recipe directory
        "outputPath": "dest/{{var1}}.ts"  // Output path ({{var}} patterns resolved)
      }
    ]
  }
}
```

### Composition via `extends`

Recipes can declare dependencies on other recipes using the `extends` field. When a recipe with `extends` is launched, all children are rendered automatically in pre-order (parent first), with variables flowing from parent to child through an optional mapping layer.

```json
{
  "name": "page",
  "variables": ["widgetName", "storeName"],
  "extends": [
    {
      "recipe": "new-component",
      "variables": ["componentName"],
      "map": { "widgetName": "componentName" }
    },
    {
      "recipe": "new-store",
      "variables": ["storeName"]
    }
  ],
  ...
}
```

Each `extends` entry:

| Field | Required | Description |
|-------|----------|-------------|
| `recipe` | Yes | Name of the child recipe to invoke |
| `variables` | Yes | Which variables this child needs (defaults to child's own variables if omitted) |
| `map` | No | Maps parent variable names → child variable names. If a child variable name matches the parent's exactly, no mapping entry is needed |

When launched, `cuisson launch page --var widgetName=MyWidget --var storeName=Counter` will:
1. Render the page's own files with `widgetName=MyWidget`, `storeName=Counter`
2. Render new-component's files with `componentName=MyWidget` (mapped from parent)
3. Render new-store's files with `storeName=Counter` (direct pass-through)

### Pattern File Format (`patterns.json`)

Auto-generated by `detect-patterns`:

```json
{
  "version": 1,
  "project": "my-project",
  "detected_at": "2026-06-17T12:00:00Z",
  "clusters": [
    {
      "id": "ui-component-1",
      "name": "components",
      "confidence": 0.85,
      "member_count": 3,
      "intent": ["component", "ui component"],
      "files": [
        {
          "path": "src/lib/components/button.svelte",
          "skeleton_template": "button.svelte.tmpl",
          "slots": [
            {"name": "ComponentName", "positions": [1, 2], "inferred_from": "filename"}
          ]
        }
      ]
    }
  ]
}
```

## Architecture Overview

### `launch` pipeline

```
cuisson launch <recipe> --var k=v
        │
        ▼
┌─────────────────────┐
│  Discover Recipes   │  Walk templates dir, find all recipe.json files
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Resolve Variables  │  Merge --var flags + interactive prompts for missing vars
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Resolve Children   │  DFS: for each child, map parent vars → child vars
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Render Templates   │  For each node in tree (parent first, then children):
│                     │    read .tmpl → execute Go template → write output
└─────────────────────┘
```

### `detect-patterns` pipeline

```
cuisson detect-patterns --threshold 0.7 [--refine]
        │
        ▼
┌─────────────────────┐
│  Tokenization       │  Strip comments, replace literals → generate shingles
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Clustering         │  Jaccard similarity + union-find → clusters
└─────────┬───────────┘
          │ (only with --refine)
          ▼
┌─────────────────────┐
│  Skeleton Extraction│  Tree-sitter AST → align nodes, infer slots
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Write patterns.json│  ~/.cuisson/projects/<project>/patterns.json
└─────────────────────┘
```

### `generate-recipe` pipeline

```
cuisson generate-recipe <cluster-id>
        │
        ▼
┌─────────────────────┐
│  Read patterns.json │  Load cluster data from ~/.cuisson/projects/<project>/
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Extract Skeletons  │  Parse files → align ASTs → infer slots
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Infer Intent       │  File types + directory context + filename patterns
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Write recipe.json  │  + .tmpl files in templates/<cluster>/
└─────────────────────┘
```

### `recipes search` pipeline

```
cuisson recipes search --intent "query"
        │
        ▼
┌─────────────────────┐
│  Discover Recipes   │  Walk templates dir, find all recipe.json files
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Tokenize Query     │  Split query into lowercase keywords
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Score & Rank       │  Keyword overlap on intent arrays
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Output Results     │  Human-readable + JSON
└─────────────────────┘
```
