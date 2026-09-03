---
title: Quick start
description: Install a powerup pack, create your own powerup, and use it in a project.
sidebar:
  order: 2
---

This guide walks through the core `pup` workflow: install a powerup pack,
create your own powerup, use it in a project, and remove it again.

## 1. Install a powerup pack

Powerup packs come from npm or git:

```sh
pup install npm:my-package
```

Add `--local` to install into the project store instead of the global store,
and `--dry-run` to preview what would happen.

## 2. Create a powerup

Create your own powerup with a description, intent keywords, and the
variables its templates accept:

```sh
pup create my-powerup --description="Scaffolds a svelte component" --intent="new svelte component" --variables=componentName,theme
```

Powerups come in two types: **multi-use** (recurring patterns, the default
target for new work) and **single-use** (one-time additions to a project).
Set the type with `--type=multi-use` or `--type=single-use`.

## 3. Use a powerup

Apply a powerup in a project, passing its variables as flags:

```sh
pup use my-powerup --componentName=Button --theme=dark
```

Add `--dry-run` to print the rendered output instead of writing files, and
`--target-dir` to run against a different directory.

Every `pup use` records what it wrote in `.powerups/applied.json` — the
applied manifest that powers diagnosis and repair workflows.

## 4. Remove a powerup

```sh
pup uninstall my-powerup
```

Like `install`, it removes from the global store unless you pass `--local`.

## Next steps

- See the full [command reference](/reference/cli/build/) for every flag.
- Ready to write your own powerups? Follow the
  [authoring guide](/guides/authoring-powerups/).
