# Contributing to @liolocs/powerups-cli

Thanks for your interest in contributing to `pup` — a system for AI to use
existing code rather than come up with it from scratch. This document covers
how to report issues, set up the project locally, and submit changes.

## Opening issues

Before you submit an issue, please search the
[issue tracker](https://github.com/liolocs/powerups/issues) to make sure it
hasn't already been reported. A thumbs-up on an existing issue is a great way
to show interest.

When you create an issue, use the template that fits:

- **Bug report** — something isn't working as expected.
- **Feature request** — suggest a new feature or improvement.
- **Blank issue** — for anything else relevant to the project.

Templates guide you to include the context needed to triage quickly, so please
fill them in rather than deleting sections.

## Before you code

If you plan to work on a change, please check the issue tracker first and leave
a comment on (or open) the relevant issue. This avoids duplicate or unsolicited
work and lets us confirm the change is wanted before you spend time on it.

## Development setup

You'll need [Node.js](https://nodejs.org/) and
[pnpm](https://pnpm.io/) (this repo uses `pnpm@10.33.0`).

```sh
git clone https://github.com/liolocs/powerups.git
cd powerups
pnpm install
```

Common scripts:

| Script           | What it does                                   |
| ---------------- | ---------------------------------------------- |
| `pnpm build`     | Cleans `lib/`, compiles, bundles, copies templates |
| `pnpm test`      | Runs the test suite (`proby`)                  |
| `pnpm lint`      | Lints with ESLint                              |
| `pnpm lint:fix`  | Lints and auto-fixes                           |

`lib/` is build output and is gitignored — don't edit it directly.

## Project structure

```
src/
  bin.ts                        # CLI entry point
  private/
    commands/<name>/             # one directory per CLI command
    utils/                       # shared helpers
    schemas/                     # pema validation schemas
    template-runners/            # njk / ts template runners
    scaffold/templates/*.njk     # scaffolding templates
lib/                             # build output (gitignored)
```

Each command lives in `src/private/commands/<name>/`. When adding a command,
follow the existing layout (an `index.ts` plus any helpers alongside it).

## Generated readmes

Two READMEs are generated from templates and committed — don't hand-edit
them:

- `packages/cli/README.md` — rendered from
  `packages/cli/scripts/templates/readme.njk` plus the command metadata in
  `src/private/commands/<name>/index.ts` (consumed via the built
  `lib/commands/index.js`).
- `README.md` (repo root) — rendered from `scripts/templates/root-readme.njk`
  plus each package's `package.json` under `packages/`.

After changing a command's `name`, `description`, or `flags` — or a package's
`description` — rebuild and regenerate both:

```sh
pnpm --filter @liolocs/powerups-cli build
pnpm --filter @liolocs/powerups-cli readme
pnpm readme
```

## Code style

- TypeScript, ESM, strict mode.
- Use ESM import paths (explicit extensions where the loader requires them).
- Follow the patterns you see in neighboring files.
- Keep command logic in `commands/<name>/` and shared logic in `utils/`.

## Testing conventions

- Tests are colocated with source as `*.spec.ts`.
- The runner is `proby`, invoked via `pnpm test`.
- Add or update tests for any new behavior or bug fix.

## Commit conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/).
Commits are parsed by `commit-and-tag-version` (with the `conventionalcommits`
preset) to generate the `CHANGELOG.md` automatically, so commit message format
matters.

Format:

```
type(scope): summary
```

Common types:

- `feat` — new feature
- `fix` — bug fix
- `chore` — tooling, deps, config
- `refactor` — no behavior change
- `docs` — documentation
- `test` — tests
- `perf` — performance

`scope` is optional and usually a command or area (e.g. `pack`, `project`,
`scaffold`). Keep one logical change per commit.

Examples:

```
feat(pack): support moving packs between stores
fix(find): match powerups with trailing variables
chore: bump dependencies
```

## Pull requests

1. Branch off the default branch for your change.
2. Fill in the pull request template.
3. Keep the PR focused on one logical change.
4. Link the related issue (`Closes #NNN` or `Refs #NNN`).
5. Make sure `pnpm test` and `pnpm lint` pass before requesting review.

## Release & branching

Releases are automated and run by maintainers via `pnpm release`
(`commit-and-tag-version`). Do not hand-edit `CHANGELOG.md` — it is generated
from commit messages. There is no long-lived release branch; releases are
tagged from the default branch.