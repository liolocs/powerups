# Project Path Refactor Design

> **Goal:** Move all project data from `~/.cuisson/<project>` to `~/.cuisson/projects/<project>` by consolidating path construction into a single helper.

**Scope:** CLI code only. No backward compatibility — the filesystem migration is handled separately by the user.

## Changes

### 1. Add `ProjectsDir` helper in `cli/internal/project/`

Add a new function:
```go
func ProjectsDir(projectName string) string {
    home, _ := os.UserHomeDir()
    return filepath.Join(home, ".cuisson", "projects", projectName)
}
```

### 2. Update `project.TemplatesDir()` to use it

Change from:
```go
filepath.Join(home, ".cuisson", projectName, "templates")
```
To:
```go
filepath.Join(ProjectsDir(projectName), "templates")
```

### 3. Update `cli/internal/metrics/logger.go`

- Change `baseDir` construction from `filepath.Join(home, ".cuisson")` to `filepath.Join(home, ".cuisson", "projects")`
- Update comment on line 32: `// ~/.cuisson directory` → `// ~/.cuisson/projects directory`
- Update comment on line 35: same pattern
- Update comment on line 49: `~/.cuisson/<project>/metrics.jsonl` → `~/.cuisson/projects/<project>/metrics.jsonl`

### 4. Update `cli/internal/patterns/store.go`

- Change `StorePath()` from `filepath.Join(home, ".cuisson", projectName)` to `filepath.Join(home, ".cuisson", "projects", projectName)`

### 5. Update `cli/internal/recipesearch/search.go` (line ~190)

- Change from `filepath.Join(home, ".cuisson", cfg.Name, "templates")` to use the new helper

### 6. Update `cli/cmd/recipes_list.go` (line ~81)

- Same change as #5 — use the new helper instead of inline path construction

### 7. Update error messages and doc comments

All references to `~/.cuisson/<project>` or `~/.cuisson/` in error messages and comments should be updated to reflect the new layout. Affected files:
- `cli/internal/project/manager.go` — lines 24, 28, 60, 86, 90, 109
- `cli/cmd/detect_patterns.go` — lines 26, 37

### 8. Update tests

- `cli/internal/recipesearch/search_test.go` line ~350: update expected path
- `cli/internal/patterns/store_test.go` line ~85: update expected directory

## Files Modified (7 total)

| File | Change |
|------|--------|
| `cli/internal/project/config.go` | Add `ProjectsDir()`, update `TemplatesDir()` |
| `cli/internal/project/manager.go` | Update error messages/comments referencing old path |
| `cli/internal/metrics/logger.go` | Update baseDir, comments |
| `cli/internal/patterns/store.go` | Update `StorePath()` path construction |
| `cli/internal/recipesearch/search.go` | Use new helper instead of inline path |
| `cli/cmd/recipes_list.go` | Use new helper instead of inline path |
| `cli/cmd/detect_patterns.go` | Update doc comments (lines 26, 37) |
| `cli/internal/recipesearch/search_test.go` | Update expected path in test |
| `cli/internal/patterns/store_test.go` | Update expected dir in test |

## Self-Review

1. **Placeholder scan:** No TBD/TODO/vague requirements found.
2. **Internal consistency:** All path construction goes through one source of truth (`ProjectsDir`). No scattered `filepath.Join` calls remain.
3. **Scope check:** Focused — only path references, no behavioral changes.
