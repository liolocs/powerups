---
name: cuisson-plan
description: >
  Use when creating a new feature, component, store, or any code artifact in this project.
  This skill orchestrates Cuisson recipe-driven scaffolding before implementation — it checks
  whether a matching recipe exists, creates one if not (via detect-patterns), and generates
  an implementation plan that uses `cuisson launch` commands to scaffold files, followed by
  edit instructions for customization. Trigger whenever the user mentions creating a new
  feature, component, store, page, service, or any structured code artifact. Also trigger when
  the user says "add a new X", "create an X", "scaffold X", or references any folder path
  that could match a Cuisson recipe. If the user is just editing existing code without creating
  new structural artifacts, skip this skill and use normal planning.
---

# Cuisson Plan Skill

## Overview

This skill generates implementation plans that leverage **Cuisson recipes** for scaffolding.
Before writing any plan tasks, it determines whether a matching recipe exists for the target
location. If one does, the plan uses `cuisson launch` commands. If not, it first instructs
the user to create a recipe using the `detect-patterns` skill.

**Announce at start:** "I'm using the cuisson-plan skill to create the implementation plan."

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
(User preferences for plan location override this default)

## Step 1: Discover Available Recipes

Before writing any tasks, discover what recipes are available (replace `<project-name>` with the project name from .cuisson.config.json):

```bash
# List all available recipes by scanning ~/.cuisson/<project-name>/templates/
find ~/.cuisson/<project-name>/templates -name recipe.json | while read f; do
  dirname "$f" | xargs basename
done
```

Or use the CLI directly:
```bash
cuisson launch --help  # verify CLI is available
```

## Step 2: Match Target Location to a Recipe

Determine the target folder path for the new feature. Then check if any recipe's `outputPath`
pattern matches that location.

### Matching logic

A recipe matches if its `outputPath` template variables can produce the target path. For example:

| Target Path | Matching Recipe | Reasoning |
|-------------|-----------------|-----------|
| `frontend/src/lib/components/NewFeature/` | `new-component` | Matches `frontend/src/lib/components/{{componentName}}/` |
| `frontend/src/stores/new-feature.ts` | `new-store` | Matches `frontend/src/stores/{{storeName}}.ts` |
| `frontend/src/routes/new-page.svelte` | *(none)* | No recipe covers routes yet |

### If a matching recipe exists:
Proceed to Step 3 — the plan will use `cuisson launch` commands.

### If no matching recipe exists:
Proceed to Step 4 — the plan must instruct creating a recipe first.

## Step 3: Plan with Existing Recipe

When a matching recipe exists, the plan tasks should include:

### Scaffold task
```markdown
- [ ] **Step 1: Scaffold files with Cuisson**

Run: `cuisson launch <recipe-name> --var varName=value`
Expected: Files created at the target paths

Verify files exist and contain correct variable substitutions.
```

### Edit tasks (after scaffolding)
After the scaffold step, add edit tasks for any customization needed. Each task should:
- Reference exact file paths and line ranges
- Show the complete code to write (no placeholders)
- Include exact commands with expected output

### Example plan structure:

```markdown
### Task 1: Scaffold NewFeature component

- [ ] **Step 1: Scaffold with Cuisson**

Run: `cuisson launch new-component --var componentName=NewFeature`
Expected: Files created at:
  - `frontend/src/lib/components/NewFeature/index.ts`
  - `frontend/src/lib/components/NewFeature/NewFeature.svelte`

- [ ] **Step 2: Verify scaffolded files**

Check that `{{componentName}}` was replaced with `NewFeature` in all files.
```

## Step 4: Plan When No Recipe Exists

When no matching recipe exists, the plan must include a **recipe creation phase** before
any implementation tasks. This phase delegates to the `detect-patterns` skill.

### Recipe creation task structure:

```markdown
### Task 0: Create Cuisson recipe for <feature-type>

**REQUIRED SUB-SKILL:** Use `.cuisson/skills/pattern-recipe` (detect-patterns)

This task creates a new Cuisson recipe for the target pattern. The detect-patterns skill
will:

1. Scan the codebase for existing patterns similar to what we're creating
2. Design recipe variables (camelCase, descriptive names)
3. Create the recipe using `cuisson create <name> --var var1 --var var2 ...`
4. Edit `recipe.json` to map template files to output paths
5. Write `.tmpl` template files with Go template syntax
6. Test the recipe with `cuisson launch <name> --var var1=val1 ...`

**Before proceeding with implementation, the recipe MUST be validated by the user.**
Do not continue to Task 1 until the user confirms the recipe works correctly.

After validation, proceed with the implementation plan using `cuisson launch` commands
(see Step 3 above).
```

### Important rules for recipe creation:
- The detect-patterns skill handles the heavy lifting — reference it, don't reimplement its logic
- The plan should NOT include hardcoded template content at this stage; let detect-patterns figure out the right templates
- User validation is mandatory — the plan must explicitly state this checkpoint
- After recipe creation, continue with normal scaffold + edit tasks

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

Use the same bite-sized task granularity as writing-plans:

````markdown
### Task N: [Component Name]

**Files:**
- Scaffolded by: `cuisson launch <recipe-name>` (if recipe exists)
- Create/Modify: `exact/path/to/file.py`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Scaffold with Cuisson**

Run: `cuisson launch <recipe-name> --var varName=value`
Expected: Files created at target paths

- [ ] **Step 2: Verify scaffolded files**

Check that all variables were substituted correctly.
No `{{varName}}` should remain in generated files.

- [ ] **Step 3: Implement feature logic**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run tests**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/components/NewFeature/
git commit -m "feat: add NewFeature component"
```
````

## No Placeholders

Same rules as writing-plans — every step must contain actual content:
- "TBD", "TODO", "implement later" — **plan failures**
- "Add appropriate error handling" without code — **plan failure**
- Steps describing what to do without showing how — **plan failure**

## Self-Review

After writing the complete plan:

**1. Recipe coverage:** Did you check for matching recipes before writing tasks? If no recipe exists, is the detect-patterns delegation included?

**2. Scaffold verification:** Does every `cuisson launch` step include a verification step?

**3. Placeholder scan:** Search for any of the red-flag patterns from "No Placeholders."

**4. Execution order:** Do scaffold tasks come before edit tasks? Does recipe creation (if needed) come before all implementation tasks?

## Execution Handoff

After saving the plan:

**"Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?"**

If recipe creation is needed (Step 4), note: "The first task requires user validation of the created recipe before proceeding."
