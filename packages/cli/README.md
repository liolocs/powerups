# pup

The best guardrails for AI output — a system for AI to use existing code rather
than come up with it from scratch.

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

`pup` helps you manage reusable **powerups** — bits of existing code
and patterns — and make them available to AI agents working in your project.
Instead of letting an AI generate a solution from scratch, you point it at
powerups you've already written, so its output is grounded in code you trust.

## Install

```sh
npm install -g @liolocs/powerups-cli
```

Requires [Node.js](https://nodejs.org/).

> `pup` is early-stage. Expect rough edges while the surface settles.

## Quick start

Install a powerup package from npm or git:

```sh
pup install npm:my-package
```

Create a new powerup:

```sh
pup create my-powerup --description="Scaffolds a svelte component" --variables=componentName,theme
```

Use a powerup, rendering its templates with variables:

```sh
pup use my-powerup --componentName=Button --theme=dark
```

Remove an installed powerup:

```sh
pup uninstall my-powerup
```

## Commands

### `pup build`

Build a powerup for distribution

```sh
pup build [flags]
```

### `pup create`

Create a powerup

```sh
pup create [flags]
```

| Flag | Short | Type | Description |
| ---- | ----- | ---- | ----------- |
| `--dry-run` | `-dr` | boolean | Print output to stdout instead of writing files |
| `--capture` | `-c` | string | Capture files into the new powerup: "all" or "workingDir" |
| `--local` | `-l` | boolean | Create locally (default: global) |
| `--description` | `-d` | string | Human-readable description (required) |
| `--intent` | `-i` | string | Comma-separated intent keywords |
| `--variables` | `-v` | string | Comma-separated required variable names |
| `--optional-variables` | `-ov` | string | Comma-separated optional variable names |
| `--type` | `-t` | string | Powerup type: multi-use or single-use (defaults to single-use) |

`--capture=all` works without git — it captures every file in the working
directory into the new powerup. Captured files land in `src/create/` (new
files) and `src/modify/` + `fixtures/` (modified files).

### `pup install`

Install a powerup locally or globally

```sh
pup install [flags]
```

| Flag | Short | Type | Description |
| ---- | ----- | ---- | ----------- |
| `--dry-run` | `-dr` | boolean | Print output to stdout instead of writing files |
| `--local` | `-l` | boolean | Install to local project store instead of global |

### `pup uninstall`

Uninstall a powerup

```sh
pup uninstall [flags]
```

| Flag | Short | Type | Description |
| ---- | ----- | ---- | ----------- |
| `--dry-run` | `-dr` | boolean | Print what would be removed without making changes |
| `--local` | `-l` | boolean | Uninstall from local project store instead of global |

### `pup use`

Use a powerup

```sh
pup use [flags]
```

| Flag | Short | Type | Description |
| ---- | ----- | ---- | ----------- |
| `--dry-run` | `-dr` | boolean | Print output to stdout instead of writing files |
| `--target-dir` | `-td` | string | Target directory for the use command |

### `pup template`

Convert a powerup step between static and dynamic (template) form, keeping
`index.ts` in sync.

```bash
# convert a static step into a readable template, then edit it to inject variables
pup template src/components/button.tsx

# convert back to a verbatim static file
pup template src/components/button.tsx --revert

# list all steps and their static/dynamic status
pup template
```

### `pup preview`

Materialize a powerup **from source** with concrete variable values into
`preview/` and optionally run it — test boilerplates (dev servers included)
before building.

```bash
# with preview.json configured (variables, exec, watch)
pup preview

# or fully via flags
pup preview --appName=my-app --exec "npm install && npm run dev"
```

`preview.json`:

```json
{
  "variables": { "appName": "my-test-app" },
  "exec": "npm install && npm run dev",
  "outputDir": "preview",
  "watch": true
}
```

Modify steps get their base state from `fixtures/` (auto-captured from git
pre-images during `--capture=workingDir`, or hand-authored). Preview never
touches anything outside its gitignored output dir.

## Concepts

- **Powerup** — a reusable unit of code/behavior. Two types: **multi-use**
  (recurring patterns) and **single-use** (one-time additions).
- **Pack** — a package that bundles one or more powerups. Installed from npm or
  git, then available to the project.
- **Stores** — powerups live in a global store (`~/.powerups`) and a per-project
  store (`.powerups` at the project root).
- **Applied manifest** — every `pup use` records the powerup, variables,
  and files it wrote in `.powerups/applied.json`. This powers diagnosis and
  repair workflows; don't edit it by hand.

A powerup package:

```
<powerup>/
  index.ts            # steps
  src/
    create/           # verbatim sources for create steps
    dynamic-create/   # readable .ts/.njk templates for dynamic-create steps
    modify/           # pretty-printed modification JSON for modify steps
    dynamic-modify/   # readable templates for dynamic-modify steps
  fixtures/           # pre-state files for preview
  preview.json        # preview config
```

| Step | Source field | Behavior |
|---|---|---|
| `create` | `file` | verbatim copy |
| `dynamic-create` | `template` | render template |
| `modify` | `file` | parse JSON modifications, apply anchors |
| `dynamic-modify` | `template` | render → parse → apply |

## Development

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for how to set up the project
locally, run tests and lint, and submit changes.

```sh
pnpm install
pnpm build   # build to lib/
pnpm test    # run the test suite
pnpm lint    # lint
```

This README is generated from `scripts/templates/readme.njk` and the command
definitions in `src/private/commands/<name>/index.ts`. After changing a
command, rebuild and regenerate:

```sh
pnpm --filter @liolocs/powerups-cli build
pnpm --filter @liolocs/powerups-cli readme
```

## License

[MIT](../../LICENSE) © Liolocs and contributors.
