# Cuisson Metrics — Design Document

**Date:** 2026-06-18
**Status:** Approved

## Problem

Cuisson users (and their organizations) need visibility into the ROI of using Cuisson to generate code. Currently there is no way to measure how much code Cuisson has generated per recipe, per project.

## Goal

Add metrics collection to the `launch` command and a `metrics summary` subcommand for viewing aggregated statistics.

## Approach: Dedicated metrics package (Approach A)

Create `cli/internal/metrics/` with a Logger and Reader, following existing patterns (`patterns/`, `recipesearch/`). New `metrics summary` subcommand.

**Why this approach:** Proper separation of concerns, testable, follows existing codebase patterns, keeps launch focused on its job.

## Architecture

```
cli/
├── cmd/
│   ├── launch.go          ← modified: call metrics logger after render loop
│   └── metrics_summary.go ← NEW: new cobra subcommand, reads + aggregates JSONL
├── internal/
│   └── metrics/           ← NEW package
│       ├── logger.go      ← Append to JSONL file, returns count of files written
│       └── reader.go      ← Read JSONL, aggregate by recipe/project, return stats
└── ...

~/.cuisson/<project>/metrics.jsonl  ← NEW: one JSON line per launch
```

## Components

### Logger (`metrics/logger.go`)

`Log(projectName, recipeName, inputChars int, files []FileResult) error`

- `FileResult = {path string, chars int, written bool}`
- Appends one JSON line to `~/.cuisson/<project>/metrics.jsonl`
- Returns count of files actually written

### Reader (`metrics/reader.go`)

`Aggregate(projectName string) ([]RecipeStat, TotalStat)`

- Reads the JSONL file for a project
- Groups by recipe name, sums input/output chars and files written per recipe
- Returns a slice of `RecipeStat` (per-recipe totals) plus a `TotalStat`

### Launch integration

After the render loop in `launch.go`:
```go
written, err := metrics.Log(projectName, recipeName, inputChars, fileResults)
if written > 0 { /* log entry created */ }
```

### Summary command

`cuisson metrics summary [--project <name>]`

- Discovers projects by walking `~/.cuisson/` for directories with `metrics.jsonl`
- Or uses `--project` flag to target a specific project
- Prints a table: Recipe | Launches | Input Chars | Output Chars | Est Tokens Saved

## Data Flow

### `cuisson launch`
1. Discover + resolve variables (unchanged)
2. Render loop — tracks per-file chars written and whether file was actually created
3. Count files written — if > 0, call `metrics.Log()`; if 0, skip logging
4. `metrics.Log()` appends JSON line to `~/.cuisson/<project>/metrics.jsonl`

### `cuisson metrics summary`
1. Discover projects (walk `~/.cuisson/`) or use `--project` flag
2. `metrics.Aggregate()` reads JSONL, groups by recipe, sums stats
3. Print table with per-recipe and total rows

## Data Model

Each JSON line in `metrics.jsonl`:
```json
{
  "runId": "uuid-v4",
  "timestamp": "2026-06-18T17:39:00Z",
  "project": "wails3",
  "recipe": "new-component",
  "inputChars": 42,
  "files": [
    {"path": "frontend/src/lib/components/MyButton/index.ts", "chars": 150, "written": true},
    {"path": "frontend/src/lib/components/MyButton/MyButton.svelte", "chars": 800, "written": true}
  ],
  "totalOutputChars": 950
}
```

## Output Format (summary table)

```
Cuisson Metrics — wails3
───────────────────────────────────────────────
Recipe              | Launches | Input Chars | Output Chars | Est Tokens Saved
───────────────────────────────────────────────
new-component       | 5        | 210         | 4,750        | ~1,188
new-store           | 3        | 90          | 2,400        | ~600
───────────────────────────────────────────────
Total               | 8        | 300         | 7,150        | ~1,788
───────────────────────────────────────────────

Est Tokens Saved = Output Chars / 4 (rough approximation)
```

## Error Handling

- **`metrics.Log()` failures are non-fatal** — If writing to JSONL fails (disk full, permissions), launch prints a warning but continues normally. Generated files are not affected.
- **Corrupt JSONL entries** — Reader skips lines that fail to parse, logs a warning count ("⚠ 3 corrupt entries skipped"), and continues with valid data.
- **Missing metrics file** — If `metrics summary` runs for a project with no `metrics.jsonl`, it prints "No metrics recorded yet" and exits cleanly.
- **Concurrent writes** — Not a concern; Cuisson is single-process, so no race conditions on append.

## Decisions Made

1. **Raw character count only** — No token library dependency; "estimated tokens saved" is outputChars / 4.
2. **Per-project under `~/.cuisson/`** — Metrics live at `~/.cuisson/<project>/metrics.jsonl`, matching the existing patterns storage pattern.
3. **Audit-style metadata** — Full run ID, timestamp, project, recipe, input chars, per-file details (path + chars + written flag), total output chars.
4. **Only log when files are written** — Skip logging if all files already existed (no new code generated).
5. **Terminal summary table** — `cuisson metrics summary` prints a formatted table to stdout; no web dashboard.
6. **Dedicated metrics package** — Approach A: `cli/internal/metrics/` with Logger and Reader, following existing codebase patterns.
