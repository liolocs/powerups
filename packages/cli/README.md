# pup

The best guardrails for AI output — a system for AI to use existing code rather
than come up with it from scratch.

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

`pup` helps you manage reusable **powerups** — bits of existing code and
patterns — and make them available to AI agents working in your project.
Instead of letting an AI generate a solution from scratch, you point it at
powerups you've already written, so its output is grounded in code you trust.

## Install

```sh
npm install -g @liolocs/powerups-cli
```

Requires [Node.js](https://nodejs.org/).

> `pup` is early-stage (v0.0.1). Expect rough edges while the surface settles.

## Quick start

Initialize `pup` for the current project and scaffold a harness (the AI agent
you work with):

```sh
pup project init --harness claude
```

Install a powerup package from npm or git, then add it to the project:

```sh
pup install npm:my-package
pup add my-package
```

Use a powerup, rendering its templates with variables:

```sh
pup use my-powerup --var name=foo
```

Check that everything is healthy:

```sh
pup doctor
```

## Commands

| Command              | Description                                        |
| -------------------- | -------------------------------------------------- |
| `project init`       | Initialize `pup` for the current project and scaffold harnesses |
| `install <pkg>`      | Install a powerup package from npm or git          |
| `add <pkg>`          | Add an installed powerup package to this project   |
| `list`               | List installed powerup packages not yet added to this project |
| `create`             | Create a new powerup in a package                  |
| `pack create <pkg>`  | Create a new powerup package                       |
| `pack move <pkg> <scope>` | Move a powerup package between stores         |
| `find -q="..."`      | Find powerups by intent across local and global packages |
| `info <name>`        | Show how to use a powerup                          |
| `use <name>`         | Use a powerup, rendering templates with variables |
| `update`             | Update the scaffold and/or installed packages     |
| `validate <name>`    | Validate a powerup and its included package       |
| `metrics`            | View `pup` usage metrics                          |
| `doctor`             | Health check for `pup`                            |

## Concepts

- **Powerup** — a reusable unit of code/behavior. Two types: **multi-use**
  (recurring patterns) and **single-use** (one-time additions).
- **Pack** — a package that bundles one or more powerups. Installed from npm or
  git, then added to a project.
- **Harness** — the AI agent setup scaffolded into a project. Supported
  harnesses: `claude`, `opencode`, `pi`, `codex`. Omit `--harness` to
  auto-detect from the project root.
- **Stores** — powerups live in a global store (`~/.powerups`) and a per-project
  store (`.powerups` at the project root).
- **Applied manifest** — every `pup use` records the powerup, pack version,
  variables, and files it wrote in `.powerups/applied.json`. This powers
  diagnosis and repair workflows; don't edit it by hand.

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to set up the project locally,
run tests and lint, and submit changes.

```sh
pnpm install
pnpm build   # build to lib/
pnpm test    # run the test suite
pnpm lint    # lint
```

## License

[MIT](./LICENSE) © Liolocs and contributors.