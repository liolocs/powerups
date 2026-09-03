---
title: 'pup create'
description: 'Create a powerup'
sidebar:
  order: 2
---

Create a powerup

```sh
pup create [flags]
```

## Flags

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

