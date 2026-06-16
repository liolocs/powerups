---
name: detect-patterns
description: >
  How to find repetitive patterns in a codebase and turn them into reusable Cuisson recipes.
  Use this skill whenever the user asks to automate boilerplate, scaffold repetitive code,
  extract a pattern into a generator, create a recipe for something they keep writing by hand,
  or wants to reduce duplication in their project. Also use when the user mentions components,
  stores, API layers, services, hooks, utilities, or any structural pattern that appears in
  multiple places. Trigger even if the user doesn't say "recipe" or "cuisson" — if they want
  to stop writing the same thing over and over, this is the skill.
---

# Pattern → Recipe Skill

This skill teaches you how to scan a codebase, identify repetitive patterns worth automating,
and create **Cuisson recipes** that generate those patterns on demand.

## When to Use This Skill

Use this skill when the user:
- Wants to stop writing the same code structure repeatedly (boilerplate fatigue)
- Asks you to "create a recipe", "make a generator", or "scaffold X"
- Mentions they keep creating similar components, stores, API clients, hooks, etc.
- Wants to reduce duplication across their project
- Asks for a way to quickly generate new instances of an existing pattern

**Do NOT use this skill when:**
- The user just wants to run `cuisson launch` on an existing recipe (that's a direct CLI task)
- The code has no real repetition — one-offs don't need recipes
- The pattern is too variable to parameterize meaningfully

## Step 1: Discover Patterns in the Codebase

Scan the project for structural repetition. Look for:

### Component patterns
- Svelte components with similar structure (props, stores, lifecycle)
- Repeated folder layouts (`index.ts` + component file + styles)
- Shared prop interfaces or event patterns

### Store patterns
- Svelte stores with similar state shapes (writable, derived combos)
- Repeated action patterns (init, reset, update)
- Similar interface definitions

### API / service patterns
- Fetch wrappers with similar error handling
- Repeated request/response types
- Consistent API client structures

### File/folder patterns
- Recurring directory layouts (e.g., `src/lib/features/X/`)
- Repeated barrel exports (`index.ts` re-exporting everything)
- Config files, type definitions, utility modules

### How to scan efficiently
1. **List the project structure** — `find` or tree command to see top-level organization
2. **Grep for structural markers** — look for repeated imports, exports, interface names, function signatures
3. **Identify the invariant vs. the variable** — what stays the same across instances, and what changes?
4. **Pick 2-3 concrete examples** of the pattern to use as reference when writing templates

### What makes a good recipe candidate
- **At least 2 existing instances** of the pattern in the codebase
- **Clear variable parts** — things that change between instances (names, types, paths)
- **Consistent structure** — the skeleton stays the same even when content differs
- **High repetition frequency** — you'd want to generate this more than once

## Step 2: Design the Recipe Variables

Before running any commands, decide what variables the recipe needs.

### Variable naming rules
- Use **camelCase** for variable names (matches TypeScript conventions)
- Keep names **descriptive but short**: `componentName`, not `theComponentThatTheUserCreates`
- One variable per concept: separate `storeName` from `storeType` if they can vary independently

### Variable categories
| Category | Examples | Notes |
|----------|----------|-------|
| Names | `componentName`, `storeName`, `serviceName` | The primary identifier |
| Types | `stateType`, `interfaceName` | TypeScript types or interfaces |
| Paths | `outputPath` (usually derived from names) | Often computed, not user-input |
| Flags | `withTests`, `withStyles` | Boolean toggles for optional parts |

### Design tip
Think about what a human would type if they were creating this by hand. Those are your variables.

## Step 3: Create the Recipe with Cuisson CLI

The cuisson binary should already be on PATH. Use these commands:

### Scaffold the recipe structure
```bash
cuisson create <recipe-name> --var var1 --var var2 ...
```

This creates:
```
~/.cuisson/<project-name>/templates/<recipe-name>/
├── recipe.json          # Auto-generated definition
├── var1.tmpl            # Placeholder template for var1
└── var2.tmpl            # Placeholder template for var2
```

**Note:** The `~/.cuisson/<project-name>/templates/` directory is centralized per-project, project name is read from `.cuisson.config.json`.

### Edit `recipe.json`

Replace the auto-generated recipe.json with your designed output structure:

```json
{
  "name": "<recipe-name>",
  "variables": ["var1", "var2"],
  "output": {
    "files": [
      {
        "name": "Human-readable file name",
        "template": "<filename>.tmpl",
        "outputPath": "project/path/{{var1}}/to/{{var2}}"
      }
    ]
  }
}
```

**Key rules for recipe.json:**
- `variables` array order determines prompt order when running interactively
- `outputPath` uses `{{varName}}` syntax — cuisson resolves these at runtime
- Each file in `output.files` maps one `.tmpl` to one output location
- The `name` field is just a human label, doesn't affect generation

### Write the template files

Replace each `.tmpl` file with actual template content. Templates use Go's `text/template` syntax:

```go
{{.variableName}}           // Insert variable value
{{.variableName | PascalCase}}  // Apply transformation
```

**Available transformations:**
- `camelCase` — `"my_component"` → `"myComponent"`
- `PascalCase` — `"my_component"` → `"MyComponent"`
- `snake_case` — `"MyComponent"` → `"my_component"`
- `kebabCase` — `"MyComponent"` → `"my-component"`

**Template best practices:**
- Write the template as if you're creating ONE instance of the pattern by hand, but replace all variable parts with `{{.varName}}`
- Include the full file content — imports, exports, types, everything
- Use transformations to keep naming consistent (e.g., `{{.componentName | PascalCase}}` for class names)
- If a recipe generates multiple files, create one `.tmpl` per file

### Example: Multi-file component recipe

For a Svelte component that generates both the component and an index barrel file:

**recipe.json:**
```json
{
  "name": "feature-component",
  "variables": ["componentName"],
  "output": {
    "files": [
      {
        "name": "index.ts",
        "template": "index.ts.tmpl",
        "outputPath": "frontend/src/lib/components/{{componentName}}/index.ts"
      },
      {
        "name": "{{componentName}}.svelte",
        "template": "component.svelte.tmpl",
        "outputPath": "frontend/src/lib/components/{{componentName}}/{{componentName}}.svelte"
      }
    ]
  }
}
```

**index.ts.tmpl:**
```typescript
export { default } from "./{{.componentName}}.svelte";
```

**component.svelte.tmpl:**
```svelte
<script lang="ts">
  export let name: string = "{{.componentName}}";
</script>

<div class="feature-component">
  <h2>{{.componentName | PascalCase}}</h2>
  <p>Welcome, {name}!</p>
</div>

<style>
  .feature-component {
    padding: 1rem;
  }
</style>
```

## Step 4: Verify the Recipe

After creating a recipe, test it to make sure it works:

```bash
# Test with inline variables (no prompts)
cuisson launch <recipe-name> --var componentName=TestButton

# Check that the output files were created in the right locations
# Verify content looks correct (not just syntactically valid)

# Clean up test output if needed
rm -rf frontend/src/lib/components/TestButton
```

**What to verify:**
- Files land in the correct paths (no `{{varName}}` left unresolved)
- Variable substitution works for all variables
- Template transformations produce correct casing
- Generated code is syntactically valid (compiles / parses)

## Step 5: Document the Recipe

Add a comment or note about what the recipe does. You can either:
- Add a `description` field to `recipe.json` (if the schema supports it)
- Create a `README.md` in the recipe directory explaining usage
- Document it in your project's contributing guide

## Workflow Summary

```
User: "I keep creating the same kind of X"
  │
  ▼
1. Scan codebase for existing X instances
2. Identify what's invariant vs. variable
3. Design recipe variables (camelCase, descriptive)
4. Run: cuisson create <name> --var var1 --var var2 ...
5. Edit recipe.json → map files to output paths
6. Write .tmpl files with Go template syntax
7. Test: cuisson launch <name> --var var1=val1 ...
8. Clean up test output, ship it!
```

## Common Patterns to Look For

| Pattern | Typical Variables | Files Generated |
|---------|-------------------|-----------------|
| Svelte component | `componentName` | `.svelte`, `index.ts` |
| Svelte store | `storeName` | `.ts` (writable/derived) |
| API service | `serviceName`, `endpoint` | `.ts` (fetch wrapper + types) |
| Feature module | `featureName` | folder with index, types, utils |
| Custom hook | `hookName` | `.ts` (useHook pattern) |
| Page/route | `pageName` | `.svelte`, route config |

## Tips for Good Recipes

1. **Start simple** — one variable, one file. Add complexity gradually.
2. **Mirror existing code** — your template should look like the hand-written examples in the codebase.
3. **Use transformations consistently** — if your codebase uses PascalCase for component names, use `{{.name | PascalCase}}` in templates.
4. **Don't over-parameterize** — if a "variable" is always the same across instances, hardcode it.
5. **Test with realistic names** — don't just test with `test1` and `test2`; use names that look like real project code.
