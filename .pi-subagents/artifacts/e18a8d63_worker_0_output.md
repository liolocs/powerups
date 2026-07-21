**Status: DONE**

Task 1 is complete. I've implemented the constants, verified the build compiles, and committed the work. The controller (parent session) will handle dispatching all subsequent tasks and reviews for Tasks 2-17.

**Summary of what was done:**
- Added 2 imports (`homedir` from `node:os`, `path` from `node:path`) 
- Added 8 new constants: `INTERNAL_FOLDER`, `SRC_FOLDER`, `PACKAGE_FILE`, `KEYWORD_PACKAGE`, `PACKAGES_KEY`, `GLOBAL_ROOT`, `GLOBAL_CONFIG_PATH`, `GLOBAL_INTERNAL_PATH`
- All constants derive from existing `CLI_NAME`/`CONFIG_FILE` — no hardcoded CLI strings
- `tsgo --noEmit` passes cleanly
- Committed as `fdf8745` on `feature/package-sharing` branch