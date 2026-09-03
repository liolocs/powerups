# @liolocs/program

A small CLI framework for building command-line programs — the `CLI` and
`Command` primitives that `@liolocs/powerups-cli` (the `pup` binary) is
built with.

It is a thin layer over [`@rcompat/cli`](https://github.com/rcompat/rcompat):
each command declares its `name`, `description`, `flags`, and
`subcommands`, and the framework handles argument parsing, help output, and
dispatch.

## Status

`@liolocs/program` is **private** (`private: true` in its `package.json`)
and is never published or installed on its own. It exists purely as an in-repo
framework consumed by the CLI.

## Usage

Define commands with `Command` and run them with `CLI`:

```ts
import CLI, { Command } from "@liolocs/program";

const build = new Command({
  name: "build",
  description: "Build the project",
  flags: [],
  subcommands: [],
  action: async () => {
    // ...
  },
});

const program = new CLI({
  name: "mycli",
  description: "My CLI",
  version: "0.0.1",
  commands: [build],
});

await program.run();
```

### `Command`

- `name` — the word users type after the program name.
- `description` — a one-liner shown in help output.
- `flags` — each flag declares `name`, `long`, `short`, `description`, an
  optional `type` (`"boolean"` or `"string"`), and an optional `required`.
  Values arrive in `action` as `flags.<name>`.
- `subcommands` — nested `Command` instances, dispatched from `action` as
  `subcommands` (the matched names).
- `action` — receives `{ flags, subcommands, rawFlags, context }`.

### `CLI`

- `name`, `description`, `version`, `examples` — rendered into help output.
- `commands` — the top-level command list.
- `run()` — parses `process.argv` and dispatches to the matching command.

## How the CLI consumes it

`@liolocs/program` is a **devDependency** of `@liolocs/powerups-cli`, not a
runtime dependency. At build time `tsup` bundles it into the published
`pup` output, so the installed binary has no runtime dependency on this
package.

## Development

```sh
pnpm install
pnpm build   # compile to lib/
pnpm test    # run the test suite
pnpm lint    # lint
```

## License

[MIT](../../LICENSE) © Liolocs and contributors.
