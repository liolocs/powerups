---
name: saved-brainstorm
description: "Brainstorm a plan using saved templates and features"
---
Brainstorm a plan using saved templates and features.

1. Explore the project context:
   - Check recent commits, existing files, and docs.
   - Run `saved template search -q="<what the user wants to plan>"` and
     `saved feature search -q="<what the user wants to plan>"` to see if
     any templates or features already relate to this area.
   - If the searches return "No matching templates/features found", check whether
     `.saved/output/template/` or
     `.saved/output/feature/` exist and
     contain any `instructions.json` files. This distinguishes "nothing exists
     yet" (greenfield) from "items exist but none match this request."

2. Ask the user clarifying questions — one at a time — to understand:
   - What they are trying to achieve
   - What constraints apply
   - What success looks like

3. Identify the key intents (topics, domains, capabilities) this plan touches.
   For each intent, run `saved template search -q="<intent>"` and
   `saved feature search -q="<intent>"` to find existing items that
   may be reusable.

4. From the search results, determine:
   - Which existing templates or features can be reused for this plan (list by name)
   - What work doesn't fit any existing item

5. For work that doesn't fit an existing item, classify each piece as:
   - A one-off task
   - A template capture candidate (recurring pattern with different variables)
   - A feature capture candidate (one-time addition to the project)

   A task is a good template capture candidate if:
   - It generates files with a repeating structure (same file types, same wiring)
   - It will likely be done again with different variable values
   - The structure is stable enough that parameterizing it adds value

   A task is a good feature capture candidate if:
   - It's a one-time addition to the project (e.g., add a dependency, set up auth)
   - It generates files that could be re-applied to a fresh project
   - It may take variables (e.g., project name, framework choice)

   A task is one-off if:
   - It's project configuration (tsconfig, path aliases)
   - It only adds npm dependencies (use `packageDependencies` in the
     feature's `instructions.json` instead — the CLI handles `package.json`
     updates and install automatically)
   - It's a bridge or adapter specific to this project's setup
   - It's content (locale strings, copy text, data files)
   - It's a one-time wiring or edit

   IMPORTANT: Follow the build-first principle. Do NOT plan to create
   templates or features before the concrete implementation exists and is
   verified. Instead, plan the concrete implementation (what files to write,
   what they contain). Mark repeatable parts as capture candidates — to be
   captured AFTER the implementation is verified working, using the
   `saved-capture` skill.

   Subtemplates: Do NOT plan subtemplate decomposition upfront. Plan
   concrete, standalone templates. If two planned templates clearly share
   a file structure, note it as a future subtemplate extraction candidate
   — to be extracted after both templates are built and verified working.
   See the main instruction file for subtemplate mechanics.

6. Present the plan in sections, covering:
   - Overview of the approach
   - Existing templates/features to reuse (with names)
   - Concrete implementation steps (what files to write or modify)
   - Template capture candidates (to capture after implementation is verified,
     with suggested name, intent keywords, and variables)
   - Feature capture candidates (to capture after implementation is verified)
   - Non-template/feature work (one-off tasks)
   - Suggested order of implementation

   Present only the final plan. Do not include your reasoning process, internal
   notes, or chain-of-thought in the output.

7. Get user approval on the plan before proceeding.

8. Once approved, save the plan to a spec file at
   `docs/saved/specs/YYYY-MM-DD-<topic>-design.md` and commit it.
   Then transition to implementation by following the `saved-feature`
   or `saved-template` command workflow.
