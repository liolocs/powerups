---
title: Use your first powerup
description: Install a powerup pack, create your own powerup, and use it in a project.
sidebar:
  order: 2
---

This guide walks through the core `pup` workflow: install a powerup pack,
create your own powerup, use it in a project, and remove it again.

## 1. Install a powerup pack

Powerup packs come from npm or git:

```sh
pup install npm:powerup-hello-world
```

Add `--local` to install into the project store instead of the global store,
and `--dry-run` to preview what would happen.

## 2. Use a powerup

Apply a powerup in a project, passing its variables as flags:

```sh
pup use powerup-hello-world
```

Add `--dry-run` to print the rendered output instead of writing files, and
`--target-dir` to run against a different directory.

Every `pup use` records what it wrote in `.powerups/manifest.jsonl` — the
applied manifest that powers diagnosis and repair workflows.

## 3. Remove a powerup

```sh
pup uninstall powerup-hello-world
```

Like `install`, it removes from the global store unless you pass `--local`.

## Next steps

- See the full [command reference](/reference/cli/build/) for every flag.
- Ready to write your own powerups? Follow the
  [authoring guide](/guides/authoring-powerups/).
