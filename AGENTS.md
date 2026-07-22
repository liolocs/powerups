## Clean code

### Functions that have more than one parameter should have their parameters written as objects

E.G.

```ts
function Button({ componentName, theme }: { componentName: string, theme: string }) {
  `<button class="${theme}">${componentName}</button>`;
}
```
```ts
function sendMessage({ message, recipient }: { message: string, recipient: string }) {
  // Send the message to the recipient
}
```

### Variables should be descriptive

E.G.
DO:
```ts
const componentName = "Button";
const theme = "dark";

for (let color of colors) {
  // Do something
}
```
DONT:
```ts
const n = "Button";
const t = "dark";

for (let c of colors) {
  // Do something
}
```

### Spacing

You should add spaces for readability

E.G.
DO:
```ts
const componentName = "Button";
const theme = "dark";
```
DONT:
```ts
const componentName="Button";
const theme="dark";
```

### Naming

Use descriptive names for variables, functions, and files

E.G.
DO:

```ts
const harness = await detectHarness(projectRoot, harnessFlag, options);
  const config = HARNESS_CONFIG[harness];

  const variables = {
    CLI_NAME,
    CLI_CMD,
    MAIN_FOLDER,
    OUTPUT_FOLDER,
    TEMPLATE_FOLDER,
    FEATURE_FOLDER,
  };
  const filesWritten: string[] = [];
  const rollback = options?.rollback;

  const agentsRendered = await runTemplate({
    templatePath: fs.ref(`${SCAFFOLD_DIR}/templates/agents.njk`),
    variables,
  });
```
DONT:
```ts
const harness = await detectHarness(projectRoot, harnessFlag, options);
  const config = HARNESS_CONFIG[harness];
  const variables = {
    CLI_NAME,
    CLI_CMD,
    MAIN_FOLDER,
    OUTPUT_FOLDER,
    TEMPLATE_FOLDER,
    FEATURE_FOLDER,
  };
  const filesWritten: string[] = [];
  const rollback = options?.rollback;
  const agentsRendered = await runTemplate({
    templatePath: fs.ref(`${SCAFFOLD_DIR}/templates/agents.njk`),
    variables,
  });
```

### Comments

Don't add comments to code like
```ts
// 1. this section does this

// 2. this section does that
```
The code should be self-documenting. Only add comments when it makes absolute sense.

<!-- BEGIN powerups -->
## powerups (powerup engine)

This project uses the `powerups` CLI to keep AI-generated content maintainable.

Powerups live inside packages at `.powerups/internal/<package>/src/active/multi-use/<name>/` (multi-use) or
`.powerups/internal/<package>/src/active/single-use/<name>/` (single-use).

Always prefer powerups over one-off generation.

### Packages

Powerups are organized into **packages** — collections of one or more powerups that
can be created locally and optionally moved to a global location (`~/.powerups/`)
for sharing across projects.
 has a `package.json` with a `powerups` property mapping powerup names
  to their `instructions.json` path.
- The project config at `.powerups/config.json` lists installed packages in
  its `packages` array. Only powerups from packages listed in the config are visible
  to `find` and `use` (config acts as a gatekeeper).
- Local packages (in `.powerups/internal/`) are prioritized over
  global packages (in `~/.powerups/internal/`) when resolving a
  powerup by name.
- To create a new package: `pup pack create <package-name>`
- To move a local package to global: `pup pack move <package-name> global`

### Multi-use vs Single-use

- **Multi-use powerups** are recurring patterns you add multiple times with different
  variables (e.g., new API route, new view component). They keep structure
  consistent across repeated additions.
- **Single-use powerups** are one-time additions to a project (e.g., add tailwind + shadcn,
  set up auth). You use them once. They can take variables (e.g., a project
  name or framework choice).

### Skills

This project scaffolds three skills:

| Skill | When to use |
|-------|-------------|
| `powerups-brainstorm` | Planning new work — finds existing powerups, classifies work, produces a plan document |
| `powerups-implement` | Executing a plan document — works through tasks, finds/uses inline, invokes capture when needed |
| `powerups-capture` | Capturing already-done work as a powerup — user-directed or survey mode |

For ad-hoc work (not part of a plan), use the find → info → use pattern below directly.

### Before writing any new feature or file

1. Run `pup find -q="<what you're about to do>"`.
2. If a powerup matches (score > 0), run
   `pup info <name>` to see its required
   variables, generated files, and the exact use command.
3. Use it:
   `pup use <name> --<variable-name>=<value> ...`
   Preview first with `--dry-run` / `-d`, then use for real.
4. Only write fresh content if no powerup matches.

### After generating new files

If you just generated new files and the work seems repeatable, ask the user
whether they'd like to capture it as a multi-use powerup (recurring) or a single-use powerup
(one-time) before moving on. Only do this for new file generation — not for
one-off edits.

If the user confirms, invoke the `powerups-capture` skill — do not run
`create` directly. The capture skill handles the
full workflow: assessment, scaffolding, parameterization, validation, and
dry-run verification.

### `.ts` template format (recommended)

A `.ts` template is a TypeScript module that `export default`s a function.
At run time `pup` calls that function with the powerup's declared
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
- If the module has no default function (or it isn't a function), `use`
  fails with `Invalid .ts template: must export a default function that returns a
  string`. Note: `validate` only checks that the template file exists —
  it does not import or execute it, so use the powerup once to confirm the
  default export works.

### Output schema (`.powerups/internal/<package>/src/active/multi-use/<name>/instructions.json`)

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
Delete entries have no `template` field (nothing to render); at use time
the file at `outputPath` is removed from the project. If the target file
doesn't exist, a warning is printed and the entry is skipped (no error).

Template files referenced by `create` and `modify` entries live in a
`template/` subdirectory alongside `instructions.json` — i.e.
`.powerups/internal/<package>/src/active/multi-use/<name>/template/<file>`.
The `template` field holds just the bare filename; the CLI resolves it inside
that subdirectory. Files placed directly in the powerup folder (outside
`template/`) are reported as orphaned by `pup doctor`.

### Required vs Optional Variables

The `variables` field has two arrays:

- **`required`** — variables the user must provide at use time. If any are
  missing, the CLI reports all missing required variables in a single error
  along with an example command showing the required flags.
- **`optional`** — variables the user may omit. When not provided, they default
  to an empty string (`""`), so `{{var}}` tokens in templates and
  output paths resolve to `""` instead of leaving unresolved tokens.

Use `--<variable-name>=<value>` flags at use time for both required and
optional variables. When creating a powerup, use `-v` for required variables
and `-ov` for optional variables.

A variable cannot be in both `required` and `optional` — validation will reject
it. Additionally, if an optional variable is used in an `outputPath`,
validation will flag it (an optional variable in a path produces broken paths
when omitted — it should be required instead).

### Package Dependencies

The `packageDependencies` field is optional — omit it entirely if the powerup
doesn't need npm packages. Each entry is a group with an optional
`target` (a monorepo package path like `"packages/web"`, omitted for the root
`package.json`) and dependency category arrays. Dependency strings use the
standard `"package@version"` format, including scoped packages like
`"@scope/pkg@^1.0.0"`. Multiple groups can target different packages in a
monorepo.

When a powerup is used, the CLI writes the declared dependencies
to the target `package.json`, detects the package manager from the lock file
(`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`/`bun.lock`),
and runs the install command automatically.

**Do NOT create `modify` entries for `package.json`.** Use the
`packageDependencies` field instead. The CLI manages `package.json` updates and
install automatically — a modify template for `package.json` will not work
correctly because the use flow uses a git worktree and does not stage
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

A subtemplate is a regular powerup that another powerup includes via the
`includes` field. When a powerup runs, it renders its own files, then resolves
each included subtemplate — mapping the subtemplate's declared variables to
values from the parent (using `{{parentVar}}` tokens or literals),
optionally overriding output paths, and rendering the subtemplate's templates.
Subtemplates are just powerups — they live in their own folder under
`.powerups/internal/<package>/src/active/multi-use/`, have their own
`instructions.json` and templates, and can be used standalone or included
by multiple parents.

When a package is moved to global via `pup pack move <package> global`,
all inherited sub-powerups are pulled into the package and recorded in the
package's `package.json` `powerups` property using `parent:child` notation.

#### Worked example

- *Before:* You have an `api-route` powerup that generates a route handler, a
types file, and a test. Later you build a `graphql-resolver` powerup that also
needs a types file with the same structure.
- *Extraction:* Create a standalone `types` powerup
  (`pup create --pack=<package> --type=multi-use -n=types ...`). Add it to both parents'
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
- Validate: `pup validate api-route`

#### When to extract subtemplates

Create powerups first. Extract subtemplates only when a concrete use case
demands it — you often don't know what should be a subtemplate until you are
faced with the actual repetition. Extract when:

- You are duplicating the same template files across multiple powerups
- A powerup is generating files for two distinct concerns that change
  independently
- You find yourself copying a subset of one powerup's output into another

Do NOT preemptively decompose a powerup into subtemplates upfront. Build the
full powerup, verify it works, then extract when repetition emerges.

### Quick reference

| Action | Command |
|--------|---------|
| Find powerups | `pup find -q="..."` |
| Find multi-use only | `pup find -q="..." --type=multi-use` |
| Get info on a powerup | `pup info <name>` |
| Use a powerup | `pup use <name> --<variable>=<value> [-d]` |
| Create a package | `pup pack create <package-name>` |
| Create a global package | `pup pack create <package-name> -g` |
| Move package to global | `pup pack move <package-name> global` |
| Move & remove from config | `pup pack move <package-name> global -d` |
| Create a multi-use powerup | `pup create --pack=<pkg> --type=multi-use -n=<name> -i="..." -v="..." -ov="..." -o='...' -p='...'` |
| Create a single-use powerup | `pup create --pack=<pkg> --type=single-use -n=<name> -i="..." -v="..." -ov="..." -o='...' -p='...'` |
| Validate a powerup | `pup validate <name>` |
| Gain powerups | `pup gain` |
| Health check all | `pup doctor` |
| Usage metrics | `pup metrics summary` |
<!-- END powerups -->
