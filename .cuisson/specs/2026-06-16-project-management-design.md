# Cuisson Project Management Design

**Date:** 2026-06-16
**Status:** Approved

## Overview

Move cuisson templates from project-local `.cuisson/templates/` to a centralized `~/.cuisson/<project-name>/templates/` location. Each codebase that uses cuisson is registered as a "project" via a `.cuisson.config.json` file. This keeps codebases clean of template files while providing a predictable, centralized storage location.

## Architecture

```
cuisson launch <recipe> [--var k=v ...]
        │
        ▼
┌─────────────────────┐
│  Discover Project   │  Walk up from CWD for .cuisson.config.json
└─────────┬───────────┘
          │ not found → error: "No project registered. Run 'cuisson project create <name>'"
          │ found → read "name", set templatesDir = ~/.cuisson/<name>/templates/
          ▼
┌─────────────────────┐
│  Discover Recipes   │  Walk templates dir for recipe.json files
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Resolve Variables  │  --var flags + interactive prompts
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Render Templates   │  Write to output dir (CWD)
└─────────────────────┘
```

### Key Changes from Current Behavior

- **No more `.cuisson/templates` default** — if no config is found, commands error with a helpful message pointing to `cuisson project create`
- **Templates resolved from `~/.cuisson/<name>/templates/`** automatically based on project config
- **`CUISSON_TEMPLATES_DIR`** set internally from project config — no manual env vars needed
- **`CUISSON_OUTPUT_DIR`** defaults to CWD (unchanged from current behavior)
- **New `project` subcommand group** with CRUD operations

## Components & Data Flow

### New Component — Project Config Loader
- `internal/project/config.go` — walks up from CWD for `.cuisson.config.json`, reads `name` field
- Returns error if not found (commands show user-friendly message pointing to `cuisson project create`)
- Returns error if config is malformed

### New Component — Project CRUD Commands
- `cmd/project.go` — parent command group with subcommands:
  - `project create <name>` — creates `~/.cuisson/<name>/templates/` and `.cuisson.config.json` in CWD
  - `project list` — lists all registered projects (names + template paths)
  - `project delete <name>` — removes project entry and templates dir from `~/.cuisson/`
  - `project info <name>` — shows project details (config path, template dir, name)

### Modified Components
- `cmd/root.go` — removes `.cuisson/templates` default; calls project loader in `PersistentPreRun`; sets `templatesDir` from config
- `cmd/launch.go` — unchanged logic, receives resolved `templatesDir` from root
- `cmd/create.go` — same as launch (receives resolved `templatesDir`); also requires project discovery
- `internal/project/config.go` — NEW: walk-up config loader, reads `name` field
- `internal/project/manager.go` — NEW: CRUD operations for project management

### Data Flow
```
CWD → walk up for .cuisson.config.json → read "name" → ~/.cuisson/<name>/templates/
```

## Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| No config found (launch/create) | Error: `"No .cuisson.config.json found. Register this project with 'cuisson project create <name>'"`, exit 1 |
| Multiple configs found (walk-up) | Use the first one found walking up from CWD to root |
| Project name conflict (create) | Error if project with same name already exists in `~/.cuisson/` |
| Project not found (delete/info) | Error if project doesn't exist in `~/.cuisson/` |
| Config file malformed JSON | Error: `"Invalid .cuisson.config.json: <parse error>"` |
| Missing `name` field in config | Error: `"Invalid .cuisson.config.json: missing 'name' field"` |

## File Structure Changes

```
.cuisson/
├── cli/
│   ├── cmd/
│   │   ├── root.go          ← modified: project discovery in PersistentPreRun, no default templates dir
│   │   ├── launch.go        ← unchanged logic (receives resolved templatesDir)
│   │   ├── create.go        ← unchanged logic (receives resolved templatesDir)
│   │   └── project.go       ← NEW: project CRUD command group
│   ├── internal/
│   │   ├── discover/        ← unchanged
│   │   ├── render/           ← unchanged
│   │   ├── variables/        ← unchanged
│   │   └── project/          ← NEW: config loader + project management logic
│   │       ├── config.go     ← walk-up for .cuisson.config.json, read "name"
│   │       └── manager.go    ← CRUD: create, list, delete, info projects
│   ├── main.go               ← unchanged
│   └── Makefile              ← unchanged
├── templates/                ← removed: no longer used (templates centralized per-project)
├── skills/                   ← updated docs
│   ├── pattern-recipe/SKILL.md
│   └── cuisson-plan/SKILL.md
├── README.md                 ← updated docs
└── specs/                    ← design doc (this file)
```



## Project Create Flow

1. User runs `cuisson project create <name>` (or without name if auto-detected)
2. If no name provided, attempt to read `package.json` `"name"` field
3. If still no name, fall back to current directory name with interactive confirmation prompt
4. Create `~/.cuisson/<name>/templates/` directory (with parent dirs)
5. Create `.cuisson.config.json` in CWD with `{"name": "<resolved-name>"}`
6. Error if project with same name already exists

## Project Config Format

`.cuisson.config.json` in the project root:

```json
{
  "name": "<project-name>"
}
```

The `name` field is used to resolve the centralized template directory at `~/.cuisson/<project-name>/templates/`.

## Commands Requiring Project Discovery

All commands that interact with templates require a registered project:
- `cuisson launch <recipe>` — discovers project, resolves templates from `~/.cuisson/<name>/templates/`
- `cuisson create <recipe>` — same as launch (for scaffolding new recipes)

Commands that do NOT require project discovery:
- `cuisson project create <name>` — creates the project
- `cuisson project list` — lists all projects
- `cuisson project delete <name>` — removes a project
- `cuisson project info <name>` — shows project details

## Documentation Updates Required

- `README.md` — update quick start, architecture, and command docs to reflect new project-based workflow
- `skills/pattern-recipe/SKILL.md` — update references to template location and project setup
- `skills/cuisson-plan/SKILL.md` — update references to template location and project setup
