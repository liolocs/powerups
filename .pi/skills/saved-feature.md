---
name: saved-feature
description: "Search and run saved features for new additions"
---
Search and run saved features for new additions.

**Domain guard:** Before proceeding, assess whether this request is actually a
feature (a one-time addition to the project) or a template (a recurring
pattern you'll repeat). If it's a recurring pattern like "add a new API route"
or "add a view component," push back to the user: "This sounds like a recurring
pattern — consider using `saved-template` instead." Only proceed with
the feature workflow if it's genuinely a one-time addition.

If the user has already done the work and wants to capture it as a feature —
rather than generating something new — use the `saved-capture` skill
instead of this one.

1. Run `saved feature search -q="<what the user wants to build>"`.
2. If a feature matches (score > 0):
   - Run `saved feature apply <name> --<variable-name>=<value> ... -d` to preview.
   - Show the user what will be generated and where.
   - On approval, run without `-d` to write the files.
   - Note: a feature may include subfeatures — all included files
     appear in the preview/apply automatically.
3. If no feature matches:
   - Generate the new feature as requested.
   - After generating, ask the user whether they'd like to capture it as a feature.
   - If yes, run `saved feature create -n=<short-name> -i="<intent keywords>" -v="..." -ov="..." -o='...'`,
     fill in the template (prefer a `.ts` file whose default export is a function
     `(vars: Record<string, string>) => string` — the CLI calls it with the declared
     variables keyed by name and writes the returned string to `outputPath`; keep
     it a pure function of `vars`, e.g.
     `export default ({ name }: Record<string, string>) => \`# ${name}\`;`.
     Use `.njk` only when a `.ts` template is impractical),
     and run `saved feature validate -n=<name>`.
   - If the feature requires npm packages, specify them via the `-p` flag
     (e.g., `-p='[{"dependencies":["pkg@^1.0.0"]}]'`). Do NOT create a
     modify entry for `package.json` — the CLI handles dependency
     installation automatically.
