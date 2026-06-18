---
name: cuisson-new
description: >
  Use when implementing a new feature, component, store, or any structured code artifact.
  This skill uses Cuisson's built-in recipe search to find the best-matching recipe before
  scaffolding — it runs `cuisson recipes search --intent "<description>"` to discover
  existing recipes ranked by keyword overlap, then uses the top match with `cuisson launch`
  to scaffold files, followed by targeted edits for customization. Trigger whenever the user
  mentions creating a new feature, component, store, page, service, or any structured code
  artifact. Also trigger when the user says "add a new X", "create an X", "scaffold X".
  If the user is just editing existing code without creating new structural artifacts, skip
  this skill and use normal planning.
---

# Recipe-First Launch Skill

## Overview

This skill implements new functionality by **searching for an existing Cuisson recipe first**,
then scaffolding with `cuisson launch`, and finally editing the generated files. The key
difference from other approaches: it uses `cuisson recipes search --intent "..."` (the CLI's
built-in keyword-overlap search engine) instead of manually listing or scanning recipes.

**Announce at start:** "I'm using the recipe-first-launch skill to scaffold and implement this feature."

## Step 1: Search for a Matching Recipe

Before doing anything else, search the recipe index with a natural-language description of
what you want to create. The CLI scores recipes by keyword overlap on their `intent` fields.

```bash
cuisson recipes search --intent "<natural-language description of what you want to create>" --limit 3
```

### Crafting the search query

Use keywords that match how recipes describe themselves in their `intent` arrays. Look at
the existing recipes for clues:

| What you want to create | Search query | Why it works |
|-------------------------|-------------|--------------|
| A new Svelte component | `"new svelte component"` | Matches intent: "create a new component", "svelte component with index barrel" |
| A new store | `"new svelte writable store"` | Matches intent: "create a new store", "svelte writable store" |
| A UI element | `"ui component shadcn"` | Matches intent: "shadcn-style components" (if such a recipe exists) |

**Tips for better matches:**
- Use the same terminology as recipes use in their `intent` fields
- Include the framework name (`svelte`, `writable store`) if relevant
- Keep it natural — the search tokenizes on spaces and delimiters, so more keywords = more matching
- If no recipes match (zero results), proceed to Step 4

### Interpreting search results

The CLI outputs ranked results like:

```
[1] new-component (score: 3, files: 2)
    intent: "create a new component"
    intent: "svelte component with index barrel"

[2] new-store (score: 2, files: 1)
    intent: "create a new store"
```

- **Score** = number of keyword overlaps between your query and the recipe's intent strings
- **Files** = how many output files the recipe generates
- Pick the **top result** (highest score) as your scaffold target

## Step 2: Scaffold with `cuisson launch`

### 2a. Read recipe.json — MANDATORY FIRST STEP

**Before attempting any launch, read the recipe's `recipe.json` to discover ALL required variables.** This is not optional — skipping it causes trial-and-error failures that waste turns.

```bash
cat .cuisson/templates/<recipe-name>/recipe.json
```

Extract the `variables` array. Every single variable listed MUST be passed to `cuisson launch`, even if you don't have a meaningful value yet.

### 2b. Construct the full launch command with defaults

Build the complete `cuisson launch` command **before running it**, providing every variable from step 2a. Use sensible defaults for variables you don't have specific values for:

| Variable pattern | Default value |
|------------------|---------------|
| `withXxx` (boolean flags) | `false` unless the feature explicitly needs it |
| `*FieldsSchema`, `*Keys` | `""` (empty string) |
| `entityName`, `componentName`, etc. | The user's requested name |
| Other string vars | `""` or a minimal sensible default |

**Construct the full command first, then run it. Never guess variables by trial-and-error.**

```bash
# Example: api-route has 8 variables — provide ALL of them in one shot
cuisson launch api-route \
  --var entityName=author \
  --var withGet=true \
  --var withPost=false \
  --var withPut=false \
  --var withDelete=false \
  --var bodyFieldsSchema="" \
  --var bodyKeys="" \
  --var pathFieldsSchema="" \
  --var pathKeys=""
```

### 2c. Verify the scaffolded output

Check that files were created at the expected paths (from `outputPath` in recipe.json):

```bash
# Verify files exist
ls -la frontend/src/lib/components/DataTable/
cat frontend/src/lib/components/DataTable/index.ts
```

Ensure no `{{varName}}` placeholders remain in generated files. If they do, the recipe
has a bug — report it and consider creating a new recipe instead.

## Step 3: Customize the Generated Files

After scaffolding, edit the generated files to implement the actual feature logic.

### Edit workflow

1. **Read** each scaffolded file to understand the template's structure
2. **Edit** with the actual implementation — replace placeholder content, add props,
   add logic, wire up stores, etc.
3. **Verify** the result compiles and looks correct

### Example: Customizing a scaffolded component

After `cuisson launch new-component --var componentName=DataTable`:

```markdown
- [ ] **Step 2: Customize DataTable component**

Edit `frontend/src/lib/components/DataTable/DataTable.svelte`:
- Add the actual table logic (columns, data binding, sorting)
- Replace placeholder content with real implementation
- Wire up any required stores

Edit `frontend/src/lib/components/DataTable/index.ts`:
- Update exports if the template structure changed
```

### When to create a new recipe instead of editing

If you find yourself making extensive changes that would be needed for every instance
of this pattern, the template is probably wrong. In that case:

1. The current recipe doesn't fit well — the search score was low or zero
2. You'd need to edit >50% of the generated content
3. The recipe's variable set is insufficient for your use case

→ Use the `detect-patterns` skill to create a better recipe, then come back.

## Step 4: No Recipe Found — Create One First

If `cuisson recipes search` returns zero results, no existing recipe matches your need.
You must create a recipe before scaffolding.

### Option A: Use `detect-patterns` (recommended)

Delegate to the `pattern-recipe` skill which handles:
1. Scanning the codebase for similar patterns
2. Designing recipe variables
3. Creating the recipe with `cuisson create`
4. Writing template files
5. Testing with `cuisson launch`

### Option B: Create manually

```bash
# 1. Scaffold recipe structure
cuisson create <recipe-name> --var var1 --var var2

# 2. Edit recipe.json with output file mappings
# 3. Write .tmpl template files
# 4. Test: cuisson launch <recipe-name> --var var1=val1 ...
```

After the recipe is created and validated, proceed with Step 2 (launch) and Step 3 (customize).

## Troubleshooting: Launch Fails with "unknown flag" or missing var errors

This is the #1 cause of wasted turns. The pattern:

```
cuisson launch recipe --var a=b   # fails: missing var c
cuisson launch recipe --var a=b --var c=d  # fails: missing var e
cuisson launch recipe --var a=b --var c=d --var e=f  # finally works
```

**Fix: Always read recipe.json first.** The `variables` array lists every required var.
Construct the full command with all vars in one shot. See Step 2a–2b above.

## Decision Flowchart

```
User wants to create X
        │
        ▼
cuisson recipes search --intent "what X is"
        │
    ┌───┴───┐
    │       │
  Results   No results (0 matches)
    │       │
    ▼       ▼
Step 2:   Step 4: Create recipe first
Scaffold      (detect-patterns skill)
    │
    ▼
Step 3: Customize generated files
```

## Common Recipe Queries Reference

Based on existing recipes in this project:

| What you want | Run this search | Expected recipe |
|---------------|-----------------|-----------------|
| New component | `"new svelte component"` | `new-component` (score: ~3) |
| New store | `"new svelte writable store"` | `new-store` (score: ~3) |
| New UI element | `"ui component"` | `new-component` (score: ~2) |
| New page/route | `"page route"` | *(none yet — create recipe)* |

## Important Rules

1. **Always search first** — never guess which recipe to use. The CLI's keyword-overlap
   scoring is the authoritative source for matching.

2. **Read recipe.json before launching — MANDATORY** — extract ALL variable names from the
   `variables` array. Every variable MUST be passed to launch, even with a default value.
   **Never attempt `cuisson launch` without first reading recipe.json.** Trial-and-error
   variable discovery wastes turns and causes repeated failures.

3. **Construct the full command before running it** — list every `--var` flag upfront.
   If a launch fails, read the error to understand what's missing, then retry with
   the complete set — do not iteratively add one variable at a time.

4. **Verify after launch** — check that files landed in the right places and all
   `{{varName}}` placeholders were resolved.

5. **Edit, don't rewrite** — the scaffold gives you the structure; your job is to fill
   in the actual implementation logic.

6. **Flag bad recipes** — if a recipe generates files with unresolved placeholders or
   wrong paths, note it. A bad recipe should be fixed, not worked around.

7. **No recipe? Create one** — don't skip scaffolding just because no recipe exists.
   Use `detect-patterns` to generate one, then proceed.

## Example: Full Workflow

User: "Add a new Settings page component"

**Step 1 — Search:**
```bash
cuisson recipes search --intent "new svelte component" --limit 3
# → [1] new-component (score: 4, files: 2)
```

**Step 2 — Scaffold:**
```bash
# Read recipe.json first to discover ALL required variables
cat .cuisson/templates/new-component/recipe.json
# → variables: ["componentName"]

# Construct full launch command with all vars upfront
cuisson launch new-component --var componentName=SettingsPage
# → Creates:
#    frontend/src/lib/components/SettingsPage/index.ts
#    frontend/src/lib/components/SettingsPage/SettingsPage.svelte
```

**Step 3 — Customize:**
- Edit `SettingsPage.svelte` with actual settings UI (form fields, toggles, etc.)
- Edit `index.ts` if needed
- Wire up any stores or API calls

**Done.** The component is scaffolded and customized in minimal steps.
