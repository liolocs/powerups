# Cuisson

**Cuisson** (French for "cooking") is a recipe-driven code generator CLI. It uses declarative **recipes** to scaffold and generate project files from templates, with interactive variable prompts and built-in string transformation helpers.

## Quick Start

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

Cuisson has two subcommands: **`launch`** (generate files) and **`create`** (scaffold new recipes).

### Directory Structure

```
.cuisson/
├── cli/                    # Go CLI source code
│   ├── cmd/                # Cobra commands (root, create, launch)
│   ├── internal/           # Core logic
│   │   ├── discover/       # Scans templates dir for recipe.json files
│   │   ├── render/         # Renders .tmpl files with Go text/template
│   │   └── variables/      # Parses --var flags and prompts for input
│   ├── Makefile            # Build/install targets
│   └── main.go             # Entry point
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
| `CUISSON_OUTPUT_DIR`    | Project root for output file paths           | (current directory)  |

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

The `create` command scaffolds a new recipe directory with a `recipe.json` and placeholder `.tmpl` files.

```bash
cuisson create <recipe-name> --var <variable-name> [--var <another-var>]
```

### What it generates:

For `cuisson create my-service --var serviceName --var baseUrl`:

```
templates/<recipe-name>/
├── recipe.json          # Auto-generated recipe definition
├── serviceName.tmpl     # Placeholder template (contains {{.serviceName}})
└── baseUrl.tmpl         # Placeholder template (contains {{.baseUrl}})
```

The generated `recipe.json` maps each variable to a template file and output path:

```json
{
  "name": "my-service",
  "variables": ["serviceName", "baseUrl"],
  "output": {
    "files": [
      {
        "name": "serviceName",
        "template": "serviceName.tmpl",
        "outputPath": "{{serviceName}}"
      },
      {
        "name": "baseUrl",
        "template": "baseUrl.tmpl",
        "outputPath": "{{baseUrl}}"
      }
    ]
  }
}
```

### Workflow for creating recipes:

1. **Scaffold** the recipe structure:
   ```bash
   cuisson create my-api --var apiName --var endpoint
   ```

2. **Edit** the generated `recipe.json` to set correct output paths and file names:
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

3. **Edit** the `.tmpl` files with your actual template content, using `{{.variableName}}` syntax and optional helper functions.

4. **Launch** the recipe to generate files:
   ```bash
   cuisson launch my-api --var apiName=UserService --var endpoint=/api/users
   ```

## Recipe File Format (`recipe.json`)

```json
{
  "name": "string",              // Recipe display name
  "variables": ["var1", "var2"], // Required variable names (order matters for prompts)
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

## Architecture Overview

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
│  Render Templates   │  For each file: read .tmpl → execute Go template → write output
└─────────────────────┘
```
