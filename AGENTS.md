<!-- BEGIN saved -->
## saved (output engine)

This project uses the `saved` CLI to keep AI-generated content maintainable.
Templates live in `.saved/output/template/<name>/` and
features live in `.saved/output/feature/<name>/`.
Always prefer templates and features over one-off generation.

### Template vs Feature

- **Templates** are recurring patterns you add multiple times with different
  variables (e.g., new API route, new view component). They keep structure
  consistent across repeated additions.
- **Features** are one-time additions to a project (e.g., add tailwind + shadcn,
  set up auth). You apply them once. They can take variables (e.g., a project
  name or framework choice).

### Before writing any new feature or file

1. Run `saved template search -q="<what you're about to do>"` and
   `saved feature search -q="<what you're about to do>"`.
   If a template or feature matches (score > 0), apply it instead:
   `saved template apply <name> --<variable-name>=<value> ...`
   or `saved feature apply <name> --<variable-name>=<value> ...`
   Preview first with `--dry-run` / `-d`, then apply for real.
2. Only write fresh content if no template or feature matches.

### After generating new files

If you just generated new files and the work seems repeatable, ask the user
whether they'd like to capture it as a template (recurring) or a feature
(one-time) before moving on. Only do this for new file generation — not for
one-off edits.

If the user confirms, capture it:
```
saved template create -n=<short-name> \
  -d="<human-readable description>" \
  -i="<intent keywords>" \
  -v="var1,var2" -ov="optVar1,optVar2" \
  -o='{"create":[{"name":"...","template":"out.ts","outputPath":"..."}],"modify":[],"delete":[{"name":"old","outputPath":"src/old.ts"}]}'
```
Then fill in the template at
`.saved/output/template/<name>/<template>`.
Prefer a `.ts` file with a default-export function `(vars) => string` — this is
the recommended format for new templates. Nunjucks `.njk` templates
(`{{var}}` syntax) are supported but should only be used when a `.ts`
template is impractical. Validate before considering it done:
`saved template validate -n=<name>`

### `.ts` template format (recommended)

A `.ts` template is a TypeScript module that `export default`s a function.
At run time `saved` calls that function with the template's declared
variables (keyed by name, all strings) and writes the returned string to the
file's `outputPath`.

```ts
// ui-component/button.ts
export default ({ componentName, theme }: Record<string, string>) =>
  `<button class="${theme}">${componentName}</button>`;
```

- The default export must be a function `(vars: Record<string, string>) => string`.
  It receives every declared variable as a string and returns the full file
  contents as a string.
- Keep it a pure function of `vars` — do not import project code or read the
  filesystem. Compute the output string from `vars` alone.
- It runs natively on Bun/Deno; on Node it is executed in a child process with
  `--experimental-strip-types` (Node 22.6+), so write it as ESM with no
  side effects at module top level.
- If the module has no default function (or it isn't a function), `template apply`
  fails with `Invalid .ts template: must export a default function that returns a
  string`. Note: `template validate` only checks that the template file exists —
  it does not import or execute it, so apply the template once to confirm the
  default export works.

### Output schema (`.saved/output/template/<name>/instructions.json`)

```json
{
  "name": "string",
  "variables": {
    "required": ["string"],
    "optional": ["string"]
  },
  "intent": ["string"],
  "packageDependencies": [
    {
      "target": "packages/web",
      "dependencies": ["package@version"],
      "devDependencies": ["package@version"],
      "peerDependencies": ["package@version"]
    }
  ],
  "output": {
    "create": [
      { "name": "string", "template": "string", "outputPath": "string" }
    ],
    "modify": [
      { "name": "string", "template": "string", "outputPath": "string" }
    ],
    "delete": [
      { "name": "string", "outputPath": "string" }
    ]
  },
  "includes": [
    {
      "name": "subtemplate-name",
      "variables": { "subVar": "{{parentVar}}", "other": "literal" },
      "outputPathOverride": {
        "create": { "originalName": "overridden/path" },
        "delete": { "oldFile": "overridden/path" }
      }
    }
  ]
}
```

`includes` is optional — see [Subtemplates](#subtemplates) below.
Both `create` and `modify` arrays are required (can be empty `[]`).
The `delete` array is optional — omit it entirely for backward compatibility.
Delete entries have no `template` field (nothing to render); at apply time
the file at `outputPath` is removed from the project. If the target file
doesn't exist, a warning is printed and the entry is skipped (no error).

### Required vs Optional Variables

The `variables` field has two arrays:

- **`required`** — variables the user must provide at apply time. If any are
  missing, the CLI reports all missing required variables in a single error
  along with an example command showing the required flags.
- **`optional`** — variables the user may omit. When not provided, they default
  to an empty string (`""`), so `{{var}}` tokens in templates and
  output paths resolve to `""` instead of leaving unresolved tokens.

Use `--<variable-name>=<value>` flags at apply time for both required and
optional variables. When creating a template, use `-v` for required variables
and `-ov` for optional variables.

A variable cannot be in both `required` and `optional` — validation will reject
it. Additionally, if an optional variable is used in an `outputPath`,
validation will flag it (an optional variable in a path produces broken paths
when omitted — it should be required instead).

### Package Dependencies

The `packageDependencies` field is optional — omit it entirely if the template
or feature doesn't need npm packages. Each entry is a group with an optional
`target` (a monorepo package path like `"packages/web"`, omitted for the root
`package.json`) and dependency category arrays. Dependency strings use the
standard `"package@version"` format, including scoped packages like
`"@scope/pkg@^1.0.0"`. Multiple groups can target different packages in a
monorepo.

When a template or feature is applied, the CLI writes the declared dependencies
to the target `package.json`, detects the package manager from the lock file
(`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`/`bun.lock`),
and runs the install command automatically.

**Do NOT create `modify` entries for `package.json`.** Use the
`packageDependencies` field instead. The CLI manages `package.json` updates and
install automatically — a modify template for `package.json` will not work
correctly because the apply flow uses a git worktree and does not stage
`package.json` changes through the modify engine.

### Modify templates

A modify template describes changes to an existing file. It produces an array
of modification entries:

```json
[
  { "where": "top", "content": "import { X } from \"./x\";" },
  { "where": "bottom", "content": "export default {};" },
  { "where": "export const x = 1;", "content": "export const x = 2;" },
  { "where": { "after": "// Register" }, "content": "app.register(X);" },
  { "where": { "before": "// End" }, "content": "// New export" }
]
```

- `"where": "top"` → prepend `content` to the file
- `"where": "bottom"` → append `content` to the file
- `"where": "<exact string>"` → replace that exact string with `content` (must be unique)
- `"where": { "after": "<string>" }` → insert `content` immediately after the first occurrence
- `"where": { "before": "<string>" }` → insert `content` immediately before the first occurrence

Entries are applied sequentially in array order — each sees the result of the previous one.

Modify template files can be:
- `.json` — parsed directly (no variable substitution)
- `.njk` — rendered with variables first, then parsed as JSON
- `.ts` — rendered with variables, then parsed as JSON

### Subtemplates

A subtemplate is a regular template that another template includes via the
`includes` field. When a template runs, it renders its own files, then resolves
each included subtemplate — mapping the subtemplate's declared variables to
values from the parent (using `{{parentVar}}` tokens or literals),
optionally overriding output paths, and rendering the subtemplate's templates.
Subtemplates are just templates — they live in their own folder under
`.saved/output/template/`, have their own
`instructions.json` and templates, and can be applied standalone or included
by multiple parents.

#### Worked example

- *Before:* You have an `api-route` template that generates a route handler, a
types file, and a test. Later you build a `graphql-resolver` template that also
needs a types file with the same structure.
- *Extraction:* Create a standalone `types` template
  (`saved template create -n=types ...`). Add it to both parents'
  `instructions.json`:

```json
"includes": [
  {
    "name": "types",
    "variables": { "entityName": "{{modelName}}" },
    "outputPathOverride": { "create": { "types": "src/types/{{entityName}}.ts" } }
  }
]
```

- The `variables` map says: "pass the parent's `modelName` as the subtemplate's
  `entityName`." The `outputPathOverride` map says: "write the subtemplate's
  `types` file to this path instead of its default."
- Validate: `saved template validate -n=api-route`

#### When to extract subtemplates

Create templates first. Extract subtemplates only when a concrete use case
demands it — you often don't know what should be a subtemplate until you are
faced with the actual repetition. Extract when:

- You are duplicating the same template files across multiple templates
- A template is generating files for two distinct concerns that change
  independently
- You find yourself copying a subset of one template's output into another

Do NOT preemptively decompose a template into subtemplates upfront. Build the
full template, verify it works, then extract when repetition emerges.

### Quick reference

| Action | Command |
|--------|---------|
| Search templates | `saved template search -q="..."` |
| Search features | `saved feature search -q="..."` |
| Apply a template | `saved template apply <name> --<variable>=<value> [-d]` |
| Apply a feature | `saved feature apply <name> --<variable>=<value> [-d]` |
| Create a template | `saved template create -n=<name> -i="..." -v="..." -ov="..." -o='...' -p='...'` |
| Create a feature | `saved feature create -n=<name> -i="..." -v="..." -ov="..." -o='...' -p='...'` |
| Validate templates | `saved template validate [-n=<name>]` |
| Validate features | `saved feature validate [-n=<name>]` |
| Health check all | `saved doctor` |
| Usage metrics | `saved metrics summary` |
<!-- END saved -->
