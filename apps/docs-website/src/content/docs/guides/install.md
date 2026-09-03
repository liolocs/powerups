---
title: Install the CLI
description: Install the pup CLI globally with npm and verify your setup.
sidebar:
  order: 1
---

`pup` helps you manage reusable **powerups** — bits of existing code and
patterns — and make them available to AI agents working in your project.
Instead of letting an AI generate a solution from scratch, you point it at
powerups you've already written, so its output is grounded in code you trust.

## Install

```sh
npm install -g @liolocs/powerups-cli
```

Requires [Node.js](https://nodejs.org/).

## Verify

```sh
pup --version
```

## Where powerups live

- **Global store** — `~/.powerups`, shared across projects.
- **Project store** — `.powerups` at the project root, private to one project.

## Next steps

- Follow the [quick start](/guides/quick-start/) to use your first powerup.
- Browse the [command reference](/reference/cli/build/) for every `pup`
  command and its flags.
