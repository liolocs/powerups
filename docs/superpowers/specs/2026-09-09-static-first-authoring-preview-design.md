# Static-first authoring & preview — Design

## 1. Overview

Authoring a powerup today has four problems:

1. **Captured files are unreadable.** `create --capture` wraps every file via
   `wrapAsTemplate()` — `export default function(...) { return JSON.stringify(content); }` —
   producing escaped one-line strings that cannot be reviewed or edited by a human.
2. **No testability.** Captured boilerplate is string-wrapped and `use` only runs **built**
   powerups (`dist/instructions.json` + `dist/templates/`). A boilerplate powerup (e.g. a Vite
   scaffold with a dev server) cannot be executed at any point before publishing.
3. **`--capture=all` requires git.** In a non-git directory `git ls-files` exits 128;
   `io.run` rejects with the raw stderr string; `bin.ts` prints `err.message` of a string →
   the CLI literally prints `undefined`, after the scaffold was already written (orphaned
   half-created powerup).
4. **No initial state for modify steps.** A powerup that modifies existing files cannot be
   tested because there is no pre-state to apply modifications to.

Verified non-issue: flag registration (`--intent`, `--variables`, `--type`) works end-to-end
when the flags reach the CLI. The reported failure was a shell artifact — the pasted
multi-line command contained literal `\n` sequences, so the backslash continuations never
functioned; zsh executed the first segment and tried to run `--intent="..."` as a new
command. A regression test is added anyway (see §12).

**Goals**

- **Readable by construction** — every artifact the CLI generates is human-readable.
  The static/dynamic split is *verbatim data vs code-with-variables*, never
  readable-vs-unreadable.
- **Static-first authoring** — capture produces verbatim copies; variables are opt-in per
  file via a conversion command.
- **Preview** — materialize a powerup from source with concrete variable values and run it
  (dev server included), with a watch loop.
- **Robust capture** — works without git, rolls back on failure, surfaces real errors.

## 2. Decisions from brainstorming

| Decision | Choice |
|---|---|
| Convert static → dynamic | Dedicated command `pup template <outputPath>` (auto-syncs steps); not manual convention, not token auto-detection |
| Preview scope | All-in-one: materialize + `preview.json` + `--run` + watch layer |
| Restart supervision | Runtime-native via `@rcompat/runtime`: node → nodemon, bun → `--hot`/`--watch`, deno → denon; nodemon as universal fallback (node ships with every JS dev server) |
| Modify-step pre-state | Auto-capture git pre-images into `fixtures/` during `workingDir` capture, plus manual authoring/editing |
| Compatibility | **Clean break** — old all-template format is dropped; `create` becomes the static step, `dynamic-create` the template step; old-format powerups fail validation with re-capture guidance |
| Readability of dynamic templates | Backtick template literals with content verbatim; escaping limited to `` ` `` → `` \` `` and `${` → `\${` (minimum for valid TS) |
| Source layout | Organized by step type under `src/` (user-directed revision of the `files/`/`templates/`/`modifications/` proposal) |
| `modify` split | Same uniform treatment: `modify` (static JSON) + `dynamic-modify` (template). Rationale: identical readability problem on the modify side; `dynamic-create` cannot substitute because it clobbers files the powerup doesn't own; the dynamic-modify runner is today's modify mechanics (render → parse → apply) and already exists |

## 3. Step schema (SDK, clean break)

```ts
{ type: "create",         name, file:     "src/create/package.json",                    outputPath: "package.json" }  // verbatim copy
{ type: "dynamic-create", name, template: "src/dynamic-create/package.json.ts",        outputPath: "package.json" }  // render
{ type: "modify",         name, file:     "src/modify/package.json.json",              outputPath: "package.json" }  // parse + apply anchors
{ type: "dynamic-modify", name, template: "src/dynamic-modify/package.json.modify.ts", outputPath: "package.json" }  // render → parse → apply
```

- `file` for static sources, `template` for dynamic ones (`file` avoids collision with the
  existing `__source` package-origin marker). Paths are relative to the powerup root,
  matching today's `templates/...` convention.
- Static modify sources always append `.json` (`package.json` target →
  `src/modify/package.json.json`) so every target type gets an unambiguous name.
- `delete` / `read` / `install` keep their current shapes. `variableMap`, `__source`, and
  `from` carry over on all step types.
- Old-format instructions fail validation with a `CodeError` pointing at re-capture.

## 4. Source layout

```
<powerup>/
  index.ts            # instructions module (steps)
  package.json        # powerup package manifest
  src/
    create/           # verbatim sources for create steps
    dynamic-create/   # readable .ts/.njk templates for dynamic-create steps
    modify/           # pretty-printed modification JSON for modify steps
    dynamic-modify/   # readable templates for dynamic-modify steps
    read/             # extraction templates for read steps (convention; path declared in step)
  fixtures/           # pre-state files for preview
  preview.json        # preview config
  preview/            # materialized output (gitignored)
```

Directories are created lazily by capture/conversion — the scaffold does not create empty
dirs. The scaffolded `.gitignore` gains `preview/`. Every file's location tells you its step
type, 1:1.

## 5. Readable-by-construction generation

`wrapAsTemplate` is deleted. Nothing the CLI generates is ever an escaped blob.

**Dynamic template (generated by `pup template`, then hand-edited to inject variables):**

```ts
// src/dynamic-modify/package.json.modify.ts
export default function (_variables: Record<string, string>): string {
  return `[
  {
    "where": { "after": "\"dependencies\": {" },
    "content": "    \"zod\": \"^3.0.0\","
  }
]`;
}
```

Content stays verbatim except `` ` `` → `` \` `` and `${` → `\${` (minimum required for a
valid TS template literal). The author renames `_variables` and destructures when injecting
variables. `--engine=njk` generates an `.njk` template instead (content verbatim + njk
variable syntax).

**Static modify source (generated by `workingDir` capture):** the modifications array,
pretty-printed with `JSON.stringify(mods, null, 2)`.

**Static create source:** byte-identical copy of the captured file.

## 6. Capture

### `--capture=all`

- **Filesystem walk fallback — capture no longer requires git.** When a git repository is
  present, `git ls-files --cached --others --exclude-standard` is still used (it respects
  `.gitignore`); in a non-git directory, capture falls back to a filesystem walk with the
  same exclusions (`node_modules/`, `dist/`, `.git/`, lockfiles, `.env*`) and deterministic
  sorted ordering for stable step generation.
- Every file → verbatim copy at `src/create/<path>` + `{ type: "create", file, outputPath }`
  step appended to `index.ts`. No wrapping, ever.

### `--capture=workingDir`

- New files → `src/create/` copies + `create` steps.
- Modified files → `src/modify/<path>.json` (pretty-printed) + `modify` steps, **and** the
  git pre-image (`git show HEAD:<path>`) → `fixtures/<path>`.
- Deleted files → `delete` steps (unchanged). Renamed/unknown → warnings (unchanged).
- Without a git repository → `CodeError`: "capture=workingDir requires a git repository —
  use --capture=all".

### Failure handling

- **Rollback:** the scaffold runs before capture; if capture fails, the newly created
  powerup directory is removed with a message saying so. No orphaned half-created powerups.
- **`bin.ts` error normalization:** non-Error rejections (raw stderr strings from `io.run`)
  print the string itself, wrapped as an Error — fixes the `undefined` symptom for every
  `io.run` failure in the CLI.
- Flag registration needs no change (verified working); the verification command becomes a
  regression test.

## 7. `pup template` (conversion command)

- `pup template <outputPath>` — finds the step by `outputPath` and converts it:
  - `create` → `dynamic-create`: moves `src/create/<path>` → `src/dynamic-create/<path>.ts`
    (readable template per §5), rewrites the step in `index.ts`, removes the static source
    (single source of truth).
  - `modify` → `dynamic-modify`: same, wrapping the pretty-printed JSON.
- `--revert` — the inverse. If the template references variables, revert needs values to
  render with (from `preview.json` if present, otherwise an error listing them). Templates
  without variable references revert trivially.
- Bare `pup template` — lists all steps with their static/dynamic status.

## 8. `pup preview`

Runs the powerup **from source** — no build in the loop. Run from the powerup root (same
cwd contract as `build`). No clean-git requirement; writes only to its own gitignored dir.

**Load:** `index.ts` imported in place — direct import on Bun/Deno; on Node executed with
`--experimental-strip-types` (imports resolve against the powerup's own `node_modules`).

**Variables:** `preview.json` values, overridden by CLI flags. Any flag not owned by the
`preview` command itself is treated as a variable — the same parser as `use`
(`--appName=my-app`, kebab-case normalizes to camelCase). Missing required variables →
error listing them.

```json
{
  "variables": { "appName": "my-test-app" },
  "run": "npm install && npm run dev",
  "output": "preview",
  "watch": true
}
```

**Materialize** (into `preview/` by default, `output`/`--output` overridable):

1. Copy `fixtures/` in first — base state for modify steps.
2. Execute steps in order with use-command semantics, destination = preview dir:
   `create` → copy; `dynamic-create` → render; `modify` → parse + apply;
   `dynamic-modify` → render → parse → apply; `delete`/`read`/`install` unchanged semantics
   (install steps run in the preview dir).
3. The step runners get a **parameterizable source base** — `dist` for `use`, the powerup
   root for `preview`. This is the core refactor enabling preview-from-source.

**Reconcile, never nuke:** `.preview-manifest.json` inside the preview dir tracks every
generated path + content hash. Re-materialize writes only new/changed files, deletes only
files it generated but that no longer exist in source, and never touches anything untracked
(`node_modules`, `.env`, scratch edits). First run into a dirty dir treats all existing
files as untouchable.

**Watch + restart layer** (when `run` is configured; `--watch=false` for one-shot):

- Initial materialize completes **before** any process starts.
- CLI watcher on powerup source (`src/`, `fixtures/`, `index.ts`, `preview.json`) →
  debounced re-materialize via the manifest.
- Restart supervisor selected by `@rcompat/runtime`: node →
  `nodemon --watch <previewDir> --exec "<run>"` (cwd = preview dir; `node_modules` ignored
  by default; nodemon becomes a CLI dependency); bun → `--hot`/`--watch`; deno → denon.
  Runtime-native modes apply when the run command rides that runtime; otherwise nodemon is
  the universal fallback. Supervisor unavailable → run once without watch + a notice.
- Separation of concerns: our watcher = source → render; supervisor = output → restart.
- `watch` defaults to `true` when `run` is present; without `run`, materialize-and-exit
  unless `--watch` is passed explicitly.

## 9. `build`

Contract unchanged; internals extended:

- Same pipeline: pre-build checks → tsup compile → `dist/index.js` +
  `dist/instructions.json` (validated against the new schema).
- Source copying generalizes: every step's `file`/`template` path (root-relative) is copied
  `<powerup>/<path>` → `dist/<path>` — the existing copy mechanism extended from
  templates-only to both fields and all four step types.
- `_internal/` child sources adapt to the same layout.
- `dist/` ends up: `index.js`, `instructions.json`, `src/create/**`, `src/dynamic-create/**`,
  `src/modify/**`, `src/dynamic-modify/**` (+ `src/read/**` when referenced).

## 10. `use`

Extended runners, everything else unchanged:

- `create` → verbatim copy from `dist/src/create/**`.
- `modify` → read + `JSON.parse` from `dist/src/modify/**`, apply via the existing
  `apply-modifications` anchor logic.
- `dynamic-create` / `dynamic-modify` → existing runner mechanics untouched
  (render via ts/njk runner; render → parse → apply for modify).
- Manifest recording, clean-git check, install/delete/read behavior stay as-is.

## 11. Error handling

**New `CodeError`s**

- Old-format instructions detected → re-capture guidance.
- `capture=workingDir` without git.
- Preview: missing required variables (lists them); invalid `preview.json`.
- Conversion: unknown `outputPath`; step already dynamic; `--revert` with unresolved
  variable references.

**Watch-layer resilience:** a template that throws on re-render must not kill the loop or
the dev server — keep the last-good render, print the error, continue watching.

**Preview dir is generated:** manual edits inside it are overwritten on re-render (the
manifest owns every generated path).

**Known limitation (parity, not regression):** binary files in capture are read as text —
mojibake copies, same as today. Not addressed in v1.

## 12. Testing

Colocated `.spec.ts` pattern the repo already uses.

**Unit**

- fs-walk fallback: exclusion parity with git mode, deterministic ordering.
- Readable template generator: `` ` `` / `${` escaping round-trip (generate → render →
  byte-identical to source).
- Schema validation: accepts the four step types; rejects old format with the right message.
- Copy-mode and modify-parse step runners.
- Manifest reconcile: write-changed-only, delete-stale-generated, preserve-untracked,
  dirty-first-run safety.
- Preview config resolution: flags > `preview.json`; missing-variable error.
- Supervisor strategy selection per detected runtime.
- Conversion command round-trips, including `--revert` both ways and the njk engine.

**Integration**

- Capture `--capture=all` in a non-git directory (the reported repro).
- Create with `--intent`/`--variables`/`--type` flags → rendered `index.ts` contains them
  (the flag-registration regression test).
- `workingDir` capture producing `src/modify/` + `fixtures/` from pre-images.
- Build emitting `dist/src/**` for all four step types.
- Full `use` of a static+dynamic powerup.
- Preview materialize + second-run reconcile.
- Rollback on capture failure.

**Existing specs updated:** capture (wrapping → copies), build, use, `addStepsToIndex`,
test-utils scaffolds.

## 13. Migration & docs

- Built-in powerups (`create-powerup`, everything under `_internal/`) migrate to the new
  schema and layout as part of this work.
- SDK version bump (breaking change).
- Docs updated: root `AGENTS.md` powerups reference (step types, directory conventions,
  preview) + README examples.

## 14. Out of scope / future

- `--from <dir>` preview base (point preview at an existing project instead of fixtures).
- Auto-detection of variables in captured files.
- Interactive substring → variable selection in `pup template`.
- HMR-aware restarts (avoiding full dev-server restart for Vite-style servers).
- Binary file capture.