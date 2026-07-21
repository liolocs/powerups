---
name: powerups-brainstorm
description: "Brainstorm a plan using powerups"
---
Brainstorm a plan using powerups.

**Announce at start:** "I'm using the powerups-brainstorm skill to plan this work."

1. Explore the project context:
   - Check recent commits, existing files, and docs.
   - Run `pup find -q="<what the user wants to plan>"` to see if
     any powerups already relate to this area.
   - If the find returns "No matching powerups found", check whether
     `.powerups/internal/` exists and contains any
     packages with `instructions.json` files. This distinguishes "nothing exists
     yet" (greenfield) from "items exist but none match this request."

2. Ask the user clarifying questions — one at a time — to understand:
   - What they are trying to achieve
   - What constraints apply
   - What success looks like

<HARD-GATE>
Do NOT propose a plan, suggest any implementation approach, write any code,
or run any create/use command until you have:
1. Identified the key intents (topics, domains, capabilities) this plan touches
2. Run `pup find -q="<intent>"` for every identified intent
3. Run `pup info <name>` for every match found
4. Recorded the results (matches found or "no matching") for each search

If you skip the find step, you risk duplicating existing work and planning
the wrong approach. Find is not optional.
</HARD-GATE>

3. Identify the key intents (topics, domains, capabilities) this plan touches.
   For each intent, run `pup find -q="<intent>"` to find existing
   powerups that may be reusable. For every match, run
   `pup info <name>` to understand what variables
   and files are available. Record all results.

4. From the find results, determine:
   - Which existing powerups can be reused for this plan (list by
     name, with the key variables each requires)
   - What work doesn't fit any existing item

5. For work that doesn't fit an existing item, classify each piece as:
   - A one-off task
   - A multi-use capture candidate (recurring pattern with different variables)
   - A single-use capture candidate (one-time addition to the project)

   A task is a good multi-use capture candidate if:
   - It generates files with a repeating structure (same file types, same wiring)
   - It will likely be done again with different variable values
   - The structure is stable enough that parameterizing it adds value

   A task is a good single-use capture candidate if:
   - It's a one-time addition to the project (e.g., add a dependency, set up auth)
   - It generates files that could be re-applied to a fresh project
   - It may take variables (e.g., project name, framework choice)

   A task is one-off if:
   - It's project configuration (tsconfig, path aliases)
   - It only adds npm dependencies (use `packageDependencies` in the
     powerup's `instructions.json` instead — the CLI handles `package.json`
     updates and install automatically)
   - It's a bridge or adapter specific to this project's setup
   - It's content (locale strings, copy text, data files)
   - It's a one-time wiring or edit

   IMPORTANT: Follow the build-first principle. Do NOT plan to create
   powerups before the concrete implementation exists and is
   verified. Instead, plan the concrete implementation (what files to write,
   what they contain). Mark repeatable parts as capture candidates — to be
   captured AFTER the implementation is verified working, using the
   `powerups-capture` skill.

   Subtemplates: Do NOT plan subtemplate decomposition upfront. Plan
   concrete, standalone powerups. If two planned powerups clearly share
   a file structure, note it as a future subtemplate extraction candidate
   — to be extracted after both powerups are built and verified working.
   See the main instruction file for subtemplate mechanics.

6. Present the plan in sections, covering:
   - Overview of the approach
   - Existing powerups to reuse (with names and key variables)
   - Concrete implementation steps (what files to write or modify)
   - Multi-use capture candidates (to capture after implementation is verified,
     with suggested name, intent keywords, and variables)
   - Single-use capture candidates (to capture after implementation is verified)
   - Non-powerup work (one-off tasks)
   - Suggested order of implementation

   Present only the final plan. Do not include your reasoning process, internal
   notes, or chain-of-thought in the output.

7. Get user approval on the plan before proceeding.

8. Self-review the plan:
   - Did every identified intent get searched? (Check your recorded results.)
   - Are all capture candidates marked for post-implementation (not pre)?
   - Is the build-first principle followed? (No "create powerup first" steps.)
   - Are there any placeholders, gaps, or vague requirements?
   Fix any issues inline before saving.

9. Save the plan to a spec file at
   `docs/powerups/specs/YYYY-MM-DD-<topic>-design.md` and commit it.

10. Ask the user: "Plan written and committed to `<path>`. Please review it
    and let me know if you want to make any changes before we start
    implementation." Only proceed to the next step once the user approves.

11. Once the user approves, transition to implementation by invoking the
    `powerups-implement` skill to execute the plan.
