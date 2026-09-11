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
pup author create my-powerup --description="Scaffolds a svelte component" --variables=componentName,theme
```

While authoring, preview the rendered output and build it for distribution:

```sh
pup author preview
pup author build
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

### `pup author`

Commands for powerup authors

```sh
pup author <subcommand>
```

**Subcommands:** `build`,  `create`,  `preview`,  `template`

#### `pup author build`

Build a powerup for distribution

```sh
pup author build [flags]
```

#### `pup author create`

Create a powerup

```sh
pup author create [flags]
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

#### `pup author preview`

Materialize a powerup from source with concrete variables and optionally run it

```sh
pup author preview [flags]
```

| Flag | Short | Type | Description |
| ---- | ----- | ---- | ----------- |
| `--exec` | `-e` | string | Shell command to run inside the preview dir (overrides preview.json) |
| `--output-dir` | `-o` | string | Preview output directory (default: preview) |
| `--watch` | `-w` | boolean | Watch powerup sources and re-render on change (default: true when exec is set) |

#### `pup author template`

Convert a powerup step between static and dynamic (template) form

```sh
pup author template [flags]
```

| Flag | Short | Type | Description |
| ---- | ----- | ---- | ----------- |
| `--revert` | `-r` | boolean | Convert a dynamic (template) step back to static |
| `--engine` | `-e` | string | Template engine for conversion: ts (default) or njk |

### `pup harness`

Install, update, or remove powerup skills in an AI coding harness

```sh
pup harness <subcommand>
```

**Subcommands:** `init`,  `update`,  `remove`

#### `pup harness init`

Install powerup skills into a harness's global skills dir

```sh
pup harness init [flags]
```

| Flag | Short | Type | Description |
| ---- | ----- | ---- | ----------- |
| `--dry-run` | `-dr` | boolean | Print output to stdout instead of writing files |

#### `pup harness update`

Update installed powerup skills in a harness's global skills dir

```sh
pup harness update [flags]
```

| Flag | Short | Type | Description |
| ---- | ----- | ---- | ----------- |
| `--dry-run` | `-dr` | boolean | Print output to stdout instead of writing files |

#### `pup harness remove`

Remove installed powerup skills from a harness's global skills dir

```sh
pup harness remove [flags]
```

| Flag | Short | Type | Description |
| ---- | ----- | ---- | ----------- |
| `--dry-run` | `-dr` | boolean | Print output to stdout instead of writing files |

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
definitions in `src/private/commands/<group>/<name>/index.ts`. After changing a
command, rebuild and regenerate:

```sh
pnpm --filter @liolocs/powerups-cli build
pnpm --filter @liolocs/powerups-cli readme
```

## License

[MIT](../../LICENSE) © Liolocs and contributors.
