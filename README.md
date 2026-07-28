# powerups

The monorepo for `pwrp` — a system for AI to use existing code rather than come
up with it from scratch.

This workspace houses the user-facing `pwrp` CLI and the in-repo CLI framework
it's built on.

## Packages

| Package | Path | Description | Published |
| ------- | ---- | ----------- | :-------: |
| [`@pwrp/cli`](./packages/cli) | `packages/cli` | The `pwrp` CLI — the user-facing tool for managing AI powerups | ✅ |
| [`@pwrp/program`](./packages/program) | `packages/program` | Internal CLI framework (`CLI` / `Command` primitives) that `@pwrp/cli` is built with | ❌ (private) |

For installing `pwrp`, the command reference, and usage, see the
[`@pwrp/cli` README](./packages/cli/README.md).

## How the packages relate

`@pwrp/program` is a small CLI framework — it provides a `CLI` class and a
`Command` class (built on [`@rcompat/cli`](https://github.com/rcompat/rcompat)).

`@pwrp/cli` is the actual `pwrp` tool. Every command is defined with a `Command`
imported from `@pwrp/program`:

```ts
import { Command } from "@pwrp/program";
```

`@pwrp/program` is a **devDependency** of `@pwrp/cli`, not a runtime dependency.
At build time `tsup` bundles `program` into the published `@pwrp/cli` output,
so the installed `pwrp` binary has no runtime dependency on `@pwrp/program` — and
`@pwrp/program` is published as `private: true`, i.e. it is never installed on its
own. It exists purely as an in-repo framework consumed by the CLI.

## Monorepo layout

```
packages/
  cli/        # @pwrp/cli — the pwrp CLI (published)
  program/    # @pwrp/program — internal CLI framework (private)
pnpm-workspace.yaml
package.json
tsconfig.json
eslint.config.js
knip.json
```

The workspace is configured with globs for `packages/*` and `apps/*` (no apps
exist yet).

## Tooling

- **Package manager** — [pnpm](https://pnpm.io/) workspaces
- **Build** — `tsgo` (TypeScript native preview) for type-checking, `tsup` for
  bundling the CLI
- **Tests** — `proby` via `pnpm test` (run per package)
- **Lint** — ESLint
- **Dead-code analysis** — [knip](https://knip.dev/)
- **Releases** — `commit-and-tag-version` with the `conventionalcommits` preset
  (run from `packages/cli`); the changelog is generated from commit messages

## Getting started

```sh
git clone https://github.com/liolocs/powerups.git
cd powerups
pnpm install
```

Build all packages:

```sh
pnpm build:packages
```

Link the CLI locally so you can run `pwrp` from your shell during development:

```sh
pnpm local      # builds packages, then links the pwrp bin
```

Then see the [`@pwrp/cli` README](./packages/cli/README.md) for usage.

## Scripts

| Script | What it does |
| ------ | ------------ |
| `pnpm local` | Build all packages and link the `pwrp` binary locally |
| `pnpm build:packages` | Build everything under `packages/**` |
| `pnpm build:apps` | Build everything under `apps/**` |
| `pnpm upgrade` | Interactively update dependencies across the workspace |
| `pnpm knip` | Detect unused files, exports, and dependencies |
| `pnpm lint` | Lint the whole workspace with ESLint |
| `pnpm lint:fix` | Lint and auto-fix |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to report issues, set up a
package locally, run tests and lint, and submit changes.

## License

[MIT](./LICENSE) © Liolocs and contributors.