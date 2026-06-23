# Port Go CLI to TypeScript (r-cli) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port all Go CLI functionality from `cli/` to `r-cli/` (TypeScript/Bun) with local-first architecture, `.ts` template files, and `@rcompat/*` packages.

**Architecture:** Replace Go/Cobra with TypeScript/Bun, replace `~/.cuisson` global state with `.templates/` local-first layout. Templates use `.ts` files exporting `function(vars) => string` instead of Go text/template syntax. All I/O uses `@rcompat/*` packages for runtime agnosticism.

**Tech Stack:** TypeScript, Bun, `@rcompat/cli`, `@rcompat/fs`, `@rcompat/io`, `@rcompat/runtime`, nunjucks, proby

---

## Current State Analysis

### Existing r-cli files (stubs):
- `index.ts` — Entry point, prints error when no command given
- `cmd/index.ts` — Dynamic import discovery of `.ts` files in cmd/
- `cmd/launch.ts` — Stub: just logs "launch recipe"
- `cmd/generate.ts` — Stub: just logs "generate recipe"
- `lib/launchRecipe.ts` — Partial implementation (reads recipe.json, checks vars, calls outputRecipe)
- `lib/outputRecipe.ts` — Partial implementation (renders .ts and .njk templates, writes files)
- `utils/filesystem/*` — createFile, fileExists, getProjectRoot, importFile
- `utils/convert/convertStringArgsToObject.ts` — Parses "--key value" format

### Go CLI source (to port):
- `cli/cmd/` — 10 command files (root, create, launch, project, detect-patterns, generate-recipe, recipes/*, metrics/*)
- `cli/internal/` — 8 internal packages (discover, render, detect, metrics, patterns, variables, recipegen, recipesearch, validation)

### Key differences from Go:
1. **Local-first**: `.templates/` in project root instead of `~/.cuisson/projects/<name>/`
2. **Simpler init**: Single `init` command replaces `project create/list/delete/info`
3. **Template format**: `.ts` files exporting functions instead of Go text/template
4. **CLI framework**: `@rcompat/cli` + custom commander-like API instead of Cobra

---

## Target Directory Structure

```
r-cli/
├── index.ts                    # Entry point (exists, needs rewrite)
├── package.json                # Dependencies (exists, needs update)
├── cmd/                        # CLI command handlers
│   ├── index.ts               # Dynamic import discovery (exists, needs update)
│   ├── init.ts                # NEW: Initialize .templates/ in current project
│   ├── launch.ts              # EXISTING stub → full implementation
│   ├── generate-recipe.ts     # NEW: Generate recipe from detected cluster
│   ├── detect-patterns.ts     # NEW: Scan project for patterns, cluster files
│   └── recipes/               # NEW: Parent command group
│       ├── index.ts           # NEW: Subcommand discovery
│       ├── list.ts            # NEW: List all available recipes
│       ├── search.ts          # NEW: Search by intent keyword overlap
│       └── validate.ts        # NEW: Validate recipe composition
├── lib/                        # Core logic (NEW structure)
│   ├── cli.ts                 # NEW: Commander-like API built on @rcompat/cli
│   ├── project.ts             # NEW: Project root discovery (.templates/ walk-up)
│   ├── discover.ts            # NEW: Recipe discovery (scan .templates/recipes/)
│   ├── render.ts              # NEW: Template rendering engine (.ts + .njk)
│   ├── variables.ts           # NEW: Variable parsing, prompting, resolution
│   ├── composition.ts         # NEW: Recipe extends/children tree (pre-order DFS)
│   ├── metrics.ts             # NEW: Metrics logging (JSONL) and aggregation
│   ├── patterns.ts            # NEW: Pattern store read/write
│   ├── detect.ts              # NEW: Tokenization, clustering, skeleton extraction
│   └── search.ts              # NEW: Intent-based recipe search
├── utils/                      # Shared utilities (exists, needs restructure)
│   ├── convert/
│   │   └── convertStringArgsToObject.ts  # Exists, needs update
│   └── filesystem/            # Exists, needs updates
│       ├── createFile.ts
│       ├── fileExists.ts
│       ├── getProjectRoot.ts  # Needs rewrite for .templates/ walk-up
│       └── importFile.ts
└── docs/                      # Design specs (already exists)
```

## Command Mapping (Go → TypeScript)

| Go CLI | TypeScript r-cli | Status |
|--------|-----------------|--------|
| `project create` | **`init`** | NEW command, simpler behavior |
| `project list/delete/info` | **Removed** | No global project registry |
| `launch <name>` | `launch <name>` | Port + refactor for local-first |
| `generate-recipe <id>` | `generate-recipe <id>` | NEW command |
| `detect-patterns` | `detect-patterns` | NEW command |
| `recipes list` | `recipes list` | NEW command |
| `recipes search --intent "..."` | `recipes search --intent "..."` | NEW command |
| `recipes validate [name]` | `recipes validate [name]` | NEW command |
| `metrics summary [--project]` | `metrics summary [--project]` | NEW command |

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

---

## Task Breakdown

### Phase 1: Foundation — CLI framework + project discovery
- **Task 1:** Rewrite `lib/cli.ts` — Commander-like API built on @rcompat/cli
- **Task 2:** Rewrite `lib/project.ts` — Project root discovery (.templates/ walk-up)
- **Task 3:** Rewrite `index.ts` — Entry point using new CLI framework

### Phase 2: Core library modules
- **Task 4:** Rewrite `lib/discover.ts` — Recipe discovery from .templates/recipes/
- **Task 5:** Rewrite `lib/render.ts` — Template rendering (.ts functions + .nunjucks)
- **Task 6:** Rewrite `lib/variables.ts` — Variable parsing, prompting, resolution
- **Task 7:** Write `lib/composition.ts` — Recipe extends/children tree (pre-order DFS)

### Phase 3: Command implementations
- **Task 8:** Write `cmd/init.ts` — Initialize .templates/ in current project
- **Task 9:** Rewrite `cmd/launch.ts` — Full launch implementation
- **Task 10:** Write `cmd/detect-patterns.ts` — Pattern detection command
- **Task 11:** Write `cmd/generate-recipe.ts` — Recipe generation command

### Phase 4: Advanced library modules
- **Task 12:** Write `lib/detect.ts` — Tokenization + clustering pipeline
- **Task 13:** Write `lib/patterns.ts` — Pattern store read/write
- **Task 14:** Write `lib/search.ts` — Intent-based recipe search

### Phase 5: Subcommand groups
- **Task 15:** Write `cmd/recipes/index.ts` + `list.ts` — Recipes list subcommand
- **Task 16:** Write `cmd/recipes/search.ts` — Recipes search subcommand
- **Task 17:** Write `cmd/recipes/validate.ts` — Recipes validate subcommand

### Phase 6: Metrics + cleanup
- **Task 18:** Write `lib/metrics.ts` — JSONL logging and aggregation
- **Task 19:** Write `cmd/metrics/summary.ts` — Metrics summary command
- **Task 20:** Update `package.json`, restructure utils, cleanup old stubs

---

---

### Task 4: Recipe Discovery (`lib/discover.ts`)

**Files:**
- Create: `r-cli/lib/discover.ts`

**Description:** Scan `.templates/recipes/` for `recipe.json` files and return a map of recipe name to RecipeEntry. Ported from Go's `cli/internal/discover/recipe.go`.

**Implementation:**

```typescript
// lib/discover.ts — Recipe discovery (scan .templates/recipes/ for recipe.json)
import fs from "@rcompat/fs";

export interface RecipeFile {
  name: string;
  template: string;
  outputPath: string;
}

export interface RecipeChild {
  recipe: string;
  variables?: string[];
  map?: Record<string, string>;
}

export interface Recipe {
  name: string;
  variables: string[];
  intent?: string[];
  output: { files: RecipeFile[] };
  extends?: RecipeChild[];
}

export interface RecipeEntry {
  recipe: Recipe;
  dirPath: string; // directory containing recipe.json and template files
}

export async function discoverRecipes(templatesDir: string): Promise<Record<string, RecipeEntry>> {
  const recipes: Record<string, RecipeEntry> = {};

  try {
    const recipesDir = fs.ref(templatesDir).join("recipes");
    if (!(await recipesDir.exists())) {
      return recipes;
    }

    const entries = await recipesDir.list();
    for (const entry of entries) {
      if (entry.type !== "directory") continue;

      const recipeJsonPath = entry.join("recipe.json");
      if (!(await recipeJsonPath.exists())) continue;

      const data = await recipeJsonPath.json<Recipe>();
      const name = entry.name;

      recipes[name] = {
        recipe: data,
        dirPath: entry.path,
      };
    }
  } catch (err) {
    // If templates dir doesn't exist or can't be read, return empty
  }

  return recipes;
}
```

**Verification:**
```bash
# With no .templates/ directory, should return empty object
cd r-cli && node -e "import {discoverRecipes} from './lib/discover.js'; discoverRecipes('/tmp').then(r => console.log(JSON.stringify(r)))"
# Output: {}
```

---

### Task 5: Template Rendering Engine (`lib/render.ts`)

**Files:**
- Create: `r-cli/lib/render.ts`
- Modify: `r-cli/utils/filesystem/createFile.ts` (update to use @rcompat/fs)

**Description:** Two template formats: `.ts` files exporting `function(vars) => string` (new default), and `.njk` Nunjucks templates. Shared behavior: output path resolution with `{{var}}` replacement, strcase transformations, skip-if-exists file writing.

**Implementation:**

```typescript
// lib/render.ts — Template rendering engine (.ts + .njk)
import fs from "@rcompat/fs";
import nunjucks from "nunjucks";

export interface RecipeFile {
  name: string;
  template: string;
  outputPath: string;
}

export async function renderFile(
  recipeDirPath: string,
  recipeFile: RecipeFile,
  variables: Record<string, string>,
  outputDir: string
): Promise<{ written: boolean; outputPath: string }> {
  // Resolve output path (replace {{var}} patterns)
  const resolvedOutputPath = resolveOutputPath(recipeFile.outputPath, variables);

  // Get template content based on extension
  const templateContent = await getTemplate(recipeDirPath, recipeFile.template, variables);

  // Build full output path
  const fullPath = outputDir ? `${outputDir}/${resolvedOutputPath}` : resolvedOutputPath;

  // Ensure output directory exists
  const fileRef = fs.ref(fullPath);
  await fileRef.directory.create();

  // Skip if exists (like Go version)
  if (await fileRef.exists()) {
    console.log(`[-] File ${fullPath} already exists`);
    return { written: false, outputPath: fullPath };
  }

  // Write file
  await fileRef.write(templateContent);
  console.log(`[+] Created file ${fullPath}`);

  return { written: true, outputPath: fullPath };
}

async function getTemplate(
  recipeDirPath: string,
  templateName: string,
  variables: Record<string, string>
): Promise<string> {
  const filePath = `${recipeDirPath}/${templateName}`;
  const ext = templateName.split(".").pop();

  switch (ext) {
    case "ts":
      return getTsTemplate(filePath, variables);
    case "njk":
      return getNunjucksTemplate(recipeDirPath, templateName, variables);
    default:
      throw new Error(`Unsupported template extension: ${ext}`);
  }
}

async function getTsTemplate(
  filePath: string,
  variables: Record<string, string>
): Promise<string> {
  const mod = await fs.ref(filePath).import<{
    default: (vars: Record<string, string>) => string;
  }>();
  return mod.default(variables);
}

function getNunjucksTemplate(
  recipeDirPath: string,
  templateName: string,
  variables: Record<string, string>
): string {
  nunjucks.configure(recipeDirPath);
  return nunjucks.render(templateName, variables);
}

function resolveOutputPath(path: string, variables: Record<string, string>): string {
  let result = path;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}
```

**Verification:**
```bash
# Test resolveOutputPath function
cd r-cli && node -e "
const {resolveOutputPath} = require('./lib/render.js');
console.log(resolveOutputPath('src/{{name}}/index.ts', {name: 'MyComponent'}));
// Output: src/MyComponent/index.ts
"
```

---

### Task 6: Variable Resolution (`lib/variables.ts`)

**Files:**
- Create: `r-cli/lib/variables.ts`
- Modify: `r-cli/utils/convert/convertStringArgsToObject.ts` (update to key=value format)

**Description:** Parse `--var key=value` flags into a map, prompt for missing required variables using readline. Ported from Go's `cli/internal/variables/prompt.go`.

**Implementation:**

```typescript
// lib/variables.ts — Variable parsing, prompting, resolution
import io from "@rcompat/io";

export function parseVarFlags(flags: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const flag of flags) {
    const eqIndex = flag.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid variable format "${flag}", expected key=value`);
    }
    const key = flag.slice(0, eqIndex);
    const value = flag.slice(eqIndex + 1);
    result[key] = value;
  }

  return result;
}

export async function resolveVariables(
  required: string[],
  provided: Record<string, string>
): Promise<Record<string, string>> {
  const result = { ...provided };

  for (const req of required) {
    if (result[req] !== undefined) continue; // already provided

    process.stdout.write(`Enter value for ${req}: `);
    const input = await io.stdin.readline();

    if (!input) {
      throw new Error(`Failed to read input for ${req}`);
    }

    result[req] = input.trim();
  }

  return result;
}
```

Wait — `@rcompat/io` doesn't have a `readline` method on stdin. Let me check the actual API.

Looking at `@rcompat/cli`'s prompt module, it has `prompt.readline()` which returns a Promise<string>. Let me use that instead:

```typescript
// lib/variables.ts — Variable parsing, prompting, resolution
import cli from "@rcompat/cli";

export function parseVarFlags(flags: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const flag of flags) {
    const eqIndex = flag.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid variable format "${flag}", expected key=value`);
    }
    const key = flag.slice(0, eqIndex);
    const value = flag.slice(eqIndex + 1);
    result[key] = value;
  }

  return result;
}

export async function resolveVariables(
  required: string[],
  provided: Record<string, string>
): Promise<Record<string, string>> {
  const result = { ...provided };

  for (const req of required) {
    if (result[req] !== undefined) continue; // already provided

    process.stdout.write(`Enter value for ${req}: `);
    const input = await cli.prompt.readline();

    if (!input) {
      throw new Error(`Failed to read input for ${req}`);
    }

    result[req] = input.trim();
  }

  return result;
}
```

**Verification:**
```bash
cd r-cli && node -e "
const {parseVarFlags} = require('./lib/variables.js');
console.log(JSON.stringify(parseVarFlags(['name=Foo', 'type=bar'])));
// Output: {\"name\":\"Foo\",\"type\":\"bar\"}
"
```

---

### Task 7: Recipe Composition (`lib/composition.ts`)

**Files:**
- Create: `r-cli/lib/composition.ts`

**Description:** Resolve the recipe extends/children tree in pre-order DFS. Each child inherits variables from parent via optional mapping. Ported from Go's `cli/internal/render/recipe.go`.

**Implementation:**

```typescript
// lib/composition.ts — Recipe extends/children tree resolution (pre-order DFS)
import { RecipeEntry, RecipeChild } from "./discover.js";

export interface CompositionNode {
  entry: RecipeEntry;
  variables: Record<string, string>;
}

export function resolveCompositionTree(
  parentEntry: RecipeEntry,
  parentVars: Record<string, string>,
  allRecipes: Record<string, RecipeEntry>
): CompositionNode[] {
  const nodes: CompositionNode[] = [];

  // Add parent node
  nodes.push({
    entry: parentEntry,
    variables: { ...parentVars },
  });

  // Process children if any
  const extendsList = parentEntry.recipe.extends || [];
  for (const childDef of extendsList) {
    const childEntry = allRecipes[childDef.recipe];
    if (!childEntry) {
      throw new Error(
        `Unknown recipe "${childDef.recipe}" referenced by "${parentEntry.recipe.name}"`
      );
    }

    // Resolve child variables from parent variables
    const varsToResolve = (childDef.variables || []).length > 0
      ? childDef.variables!
      : childEntry.recipe.variables;

    const childVars: Record<string, string> = {};
    for (const varName of varsToResolve) {
      let parentVarName = varName;

      // Map is parent→child: find which parent var maps to this child var
      if (childDef.map) {
        for (const [pVar, cVar] of Object.entries(childDef.map)) {
          if (cVar === varName) {
            parentVarName = pVar;
            break;
          }
        }
      }

      const val = parentVars[parentVarName];
      if (val === undefined) {
        throw new Error(
          `Child "${childDef.recipe}" requires variable "${varName}", not available in parent`
        );
      }

      childVars[varName] = val;
    }

    // Recurse into child's children (pre-order)
    const childNodes = resolveCompositionTree(childEntry, childVars, allRecipes);
    nodes.push(...childNodes);
  }

  return nodes;
}
```

**Verification:**
```bash
# Test with a simple composition scenario
cd r-cli && node -e "
const {resolveCompositionTree} = require('./lib/composition.js');
const parentEntry = {
  recipe: { name: 'parent', variables: ['name'], extends: [{ recipe: 'child', map: { name: 'component' } }] },
  dirPath: '/tmp'
};
const childEntry = {
  recipe: { name: 'child', variables: ['component'] },
  dirPath: '/tmp'
};
const allRecipes = { parent: parentEntry, child: childEntry };
const nodes = resolveCompositionTree(parentEntry, { name: 'MyComp' }, allRecipes);
console.log(nodes.map(n => n.entry.recipe.name + ':' + JSON.stringify(n.variables)));
// Output: [\"parent:{\\\"name\\\":\\\"MyComp\\\"}\", \"child:{\\\"component\\\":\\\"MyComp\\\"}\\\"]
"
```

---

## Acceptance Criteria

**Files:**
- Create: `r-cli/lib/cli.ts`

**Description:** Build a fluent commander-like API on top of `@rcompat/cli` for output formatting and `@rcompat/runtime` for process args/exit. This provides command registration, option parsing, argument parsing, help generation, and subcommand groups.

**Implementation:**

```typescript
// lib/cli.ts — Commander-like API built on @rcompat/cli
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";

interface CommandDef {
  name: string;
  description?: string;
  usage?: string;
  options: OptionDef[];
  positionalArgs: PositionalArgDef[];
  action: (args: Record<string, string>, positionalArgs: string[]) => Promise<void>;
  parent?: CommandDef | null;
  children: CommandDef[];
}

interface OptionDef {
  short?: string;
  long: string;
  description?: string;
  required?: boolean;
  repeatable?: boolean;
}

interface PositionalArgDef {
  name: string;
  required: boolean;
}

function createProgram(): {
  command(name: string, description?: string): CommandBuilder;
  parse(): Promise<void>;
} {
  const commands: Map<string, CommandDef> = new Map();
  let rootCommands: CommandDef[] = [];

  function createCommand(name: string, description?: string): CommandBuilder {
    const def: CommandDef = {
      name,
      description,
      options: [],
      positionalArgs: [],
      action: async () => {},
      parent: null,
      children: [],
    };

    return {
      description(desc: string): CommandBuilder {
        def.description = desc;
        return this;
      },
      usage(usage: string): CommandBuilder {
        def.usage = usage;
        return this;
      },
      option(shortLong: string, description?: string): CommandBuilder {
        const parts = shortLong.split(",").map(s => s.trim());
        const option: OptionDef = { long: "", description, required: false, repeatable: false };
        for (const part of parts) {
          const trimmed = part.trim();
          if (/^--/.test(trimmed)) {
            option.long = trimmed.slice(2);
          } else if (/^-/.test(trimmed)) {
            option.short = trimmed.slice(1);
          }
        }
        def.options.push(option);
        return this;
      },
      requiredOption(shortLong: string, description?: string): CommandBuilder {
        const opt = this.option(shortLong, description);
        // Mark as required by setting a flag on the last added option
        (def.options[def.options.length - 1] as any).required = true;
        return this as unknown as CommandBuilder;
      },
      action(fn: (args: Record<string, string>, positionalArgs: string[]) => Promise<void>): CommandBuilder {
        def.action = fn;
        return this;
      },
      build(): CommandDef {
        commands.set(name, def);
        return def;
      },
    } as unknown as CommandBuilder;
  }

  interface CommandBuilder {
    description(desc: string): CommandBuilder;
    usage(usage: string): CommandBuilder;
    option(shortLong: string, description?: string): CommandBuilder;
    requiredOption(shortLong: string, description?: string): CommandBuilder;
    action(fn: (args: Record<string, string>, positionalArgs: string[]) => Promise<void>): CommandBuilder;
    build(): CommandDef;
  }

  function parseArgs(argv: string[]): { positional: string[]; options: Record<string, string[]> } {
    const positional: string[] = [];
    const options: Record<string, string[]> = {};
    let i = 0;

    while (i < argv.length) {
      const arg = argv[i];

      if (/^--/.test(arg)) {
        const key = arg.slice(2);
        if (!options[key]) options[key] = [];

        // Check if next arg is a value (not another flag)
        if (i + 1 < argv.length && !/^--/.test(argv[i + 1])) {
          options[key].push(argv[i + 1]);
          i += 2;
        } else {
          options[key].push("");
          i += 1;
        }
      } else if (/^-/.test(arg)) {
        // Short flags: -v or --var=value
        const shortKey = arg.slice(1);
        if (!options[shortKey]) options[shortKey] = [];

        if (i + 1 < argv.length && !/^-/.test(argv[i + 1])) {
          options[shortKey].push(argv[i + 1]);
          i += 2;
        } else {
          options[shortKey].push("");
          i += 1;
        }
      } else {
        positional.push(arg);
        i += 1;
      }
    }

    return { positional, options };
  }

  function findCommand(name: string): CommandDef | undefined {
    return commands.get(name);
  }

  function showHelp(cmd: CommandDef | null) {
    if (!cmd) {
      cli.print(cli.bg.red(cli.fg.white(" ERROR ")), "No command specified.");
      cli.print("");
      cli.print("Available commands:");
      for (const [name, def] of commands.entries()) {
        if (!def.parent) {
          cli.print(`  ${name}`);
          if (def.description) cli.print(`    ${def.description}`);
        }
      }
      return;
    }

    const usage = cmd.usage || `${cmd.name} [options] ${cmd.positionalArgs.map(a => a.required ? `<${a.name}>` : `[${a.name}]`).join(" ")}`;
    cli.print(`Usage: ${usage}`);
    if (cmd.description) cli.print("");
    if (cmd.description) cli.print(cmd.description);

    if (cmd.options.length > 0) {
      cli.print("");
      cli.print("Options:");
      for (const opt of cmd.options) {
        const flag = opt.short ? `-${opt.short}, --${opt.long}` : `--${opt.long}`;
        cli.print(`  ${flag.padEnd(25)} ${opt.description || ""}`);
      }
    }
  }

  return {
    command(name: string, description?: string): CommandBuilder {
      return createCommand(name, description);
    },

    async parse(): Promise<void> {
      const argv = runtime.args.slice(2); // skip "bun" and script path

      if (argv.length === 0) {
        showHelp(null);
        runtime.exit(1);
      }

      const cmdName = argv[0];
      const cmdArgs = argv.slice(1);

      const cmdDef = findCommand(cmdName);
      if (!cmdDef) {
        cli.print(cli.bg.red(cli.fg.white(" ERROR ")), `Unknown command: ${cmdName}`);
        cli.print("");
        showHelp(null);
        runtime.exit(1);
      }

      const { positional, options } = parseArgs(cmdArgs);

      // Validate required options
      for (const opt of cmdDef.options) {
        if ((opt as any).required && (!options[opt.long] || options[opt.long].length === 0)) {
          cli.print(cli.bg.red(cli.fg.white(" ERROR ")), `Required option --${opt.long} is missing`);
          runtime.exit(1);
        }
      }

      // Flatten repeatable options into a single record value
      const flatOptions: Record<string, string> = {};
      for (const [key, values] of Object.entries(options)) {
        if (values.length === 0) {
          flatOptions[key] = "";
        } else if (values.length === 1) {
          flatOptions[key] = values[0];
        } else {
          // For repeatable options, join with separator or keep as array
          flatOptions[key] = values.join(",");
        }
      }

      try {
        await cmdDef.action(flatOptions, positional);
      } catch (err) {
        cli.print(cli.bg.red(cli.fg.white(" ERROR ")), String(err));
        runtime.exit(1);
      }
    },
  };
}

const program = createProgram();
export default program;
```

**Verification:**
```bash
cd r-cli && bun run index.ts --help
# Should show: "ERROR No command specified." + available commands list
cd r-cli && bun run index.ts launch --help
# Should show: "Usage: launch [options] <recipe-name>" + options list
cd r-cli && bun run index.ts unknown-cmd
# Should show: "ERROR Unknown command: unknown-cmd" + available commands list
```

---

### Task 2: Project Root Discovery (`lib/project.ts`)

**Files:**
- Create: `r-cli/lib/project.ts`

**Description:** Walk up from CWD looking for `.templates/` directory. The first one found becomes the project root — all template reads, metrics writes, and pattern storage are relative to it.

**Implementation:**

```typescript
// lib/project.ts — Project root discovery (.templates/ walk-up)
import fs from "@rcompat/fs";

export async function findProjectRoot(startDir?: string): Promise<string | null> {
  let dir = startDir ?? (await fs.cwd());

  while (true) {
    const templatesPath = typeof dir === "string" ? `${dir}/.templates` : (dir as any).path + "/.templates";
    const ref = fs.ref(templatesPath);
    if (await ref.exists()) {
      return typeof dir === "string" ? dir : dir.path;
    }

    const parent = typeof dir === "string" ? (dir as string).split("/").slice(0, -1).join("/") || "/" : (dir as any).directory.path;
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return null;
}

export function templatesDir(projectRoot: string): string {
  return `${projectRoot}/.templates`;
}

export function recipesDir(projectRoot: string): string {
  return `${projectRoot}/.templates/recipes`;
}

export function metricsPath(projectRoot: string): string {
  return `${projectRoot}/.templates/metrics.jsonl`;
}

export function patternsPath(projectRoot: string): string {
  return `${projectRoot}/.templates/patterns.json`;
}
```

**Verification:**
```bash
# Test from a directory with .templates/ parent
cd r-cli && node -e "import project from './lib/project.js'; project.findProjectRoot().then(r => console.log('root:', r))"
# Should resolve to the project root containing .templates/
```

---

### Task 3: Entry Point (`index.ts`)

**Files:**
- Modify: `r-cli/index.ts`

**Description:** Rewrite the entry point to use the new CLI framework. Dynamically import all command modules from `cmd/` and register them with the program builder.

**Implementation:**

```typescript
// index.ts — Entry point using new CLI framework
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import program from "./lib/cli.js";

// Dynamically discover and register all commands
const currentDir = import.meta.dirname;
const commandFiles = await (await fs.ref(currentDir).join("cmd")).files({
  filter: f => !f.name.includes("index.ts") && f.extension === ".ts"
});

for (const file of commandFiles) {
  const mod = await file.import("default");
  if (mod && typeof mod.register === "function") {
    mod.register(program);
  }
}

await program.parse();
```

Wait — this approach requires each command to export a `register(program)` function. But the existing cmd/index.ts uses dynamic imports with default exports. Let me reconsider.

**Revised approach:** Each command file exports a `register` function that takes the program builder and registers itself:

```typescript
// index.ts — Entry point using new CLI framework
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import program from "./lib/cli.js";

const currentDir = import.meta.dirname;
const cmdDir = fs.ref(currentDir).join("cmd");

// Discover all .ts files in cmd/ (excluding index.ts)
const commandFiles = await cmdDir.files({
  filter: f => !f.name.includes("index.ts") && f.extension === ".ts"
});

for (const file of commandFiles) {
  const mod = await file.import("default");
  if (mod && typeof mod.register === "function") {
    mod.register(program);
  }
}

await program.parse();
```

Each command file exports `register(program)` instead of a bare default function. The `cmd/index.ts` dynamic discovery is replaced by this explicit registration pattern.

**Verification:**
```bash
cd r-cli && bun run index.ts
# Should show: "ERROR No command specified." + available commands list
cd r-cli && bun run index.ts launch --help
# Should show: "Usage: launch [options] <recipe-name>"
```

---

## Acceptance Criteria

1. All 8 commands work: `init`, `launch <name>`, `generate-recipe <id>`, `detect-patterns`, `recipes list`, `recipes search --intent "..."`, `recipes validate [name]`, `metrics summary [--project]`
2. Project root discovery walks up from CWD looking for `.templates/` directory
3. Templates use `.ts` files exporting `function(vars) => string` as default format
4. Nunjucks `.njk` templates remain supported as alternative
5. Metrics logged to `.templates/metrics.jsonl` (local-first, no global state)
6. Patterns written to `.templates/patterns.json` (local-first, no global state)
7. Recipe composition resolves extends/children in pre-order DFS with variable mapping
8. Pattern detection: tokenization (comment stripping, literal replacement, 3-gram shingles) + clustering (Jaccard similarity, union-find)
9. No tree-sitter WASM dependency (deferred) — skeleton extraction uses filename-based fallback only
