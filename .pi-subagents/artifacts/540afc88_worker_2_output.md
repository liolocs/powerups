All error file changes from Phase 4 are complete. Here's a summary of what was done:

**9 files changed (8 modified + 1 new):**

| File | Changes |
|---|---|
| `initErrors.ts` | Removed `dry_folder_exists`, `multiple_harnesses_detected`, `main_folder_not_found`. Added `global_already_initialized`, `global_not_initialized`. |
| `updateErrors.ts` | Removed `no_harness_config` (empty coded errors object retained for type exports). |
| `useErrors.ts` | Updated `main_folder_not_found` message → `pup project init`. |
| `addErrors.ts` | Added `project_not_initialized` error + `MAIN_FOLDER` import. |
| `installErrors.ts` | Added `global_not_initialized` + `local_not_initialized` errors. |
| `infoErrors.ts` | Removed `main_folder_not_found` entirely. |
| `createErrors.ts` | Updated `main_folder_not_found` message → `pup project init`. |
| `doctorErrors.ts` | Updated `not_initialized` message → `pup project init`. |
| `projectErrors.ts` (NEW) | `project_already_initialized` + `project_not_initialized` errors. |

**Residual risk:** `find/index.ts:55` and `pack/create.ts:61` still reference the removed `init_errors.main_folder_not_found()`. These command files are not in Phase 5's planned scope and will need a follow-up fix.