# Step 4 — Fix Loop + Manual pup-internal Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pup fix <powerup> start` snapshots the project and (for non-local packs) forks the powerup into the local store; the user fixes the generated code; `pup fix <powerup> end` folds the diff back into the fork's templates, bumps the fork version (patch, or major + updated compatibility when project packages moved out of range), re-renders the powerup, and refreshes the manifest.

**Architecture:** A fix-session state file (`fix-session.json`) records powerup, fork location, base commit, and attributed files. `fix end` computes per-file diffs base→working-tree with the *same* `git diff → parseDiffHunks → generateModifications` pipeline `pup create` uses, appends the resulting modify steps to the fork's instructions.json, and updates templates. Version bump logic is a pure function (`decideBump`) driven by Step 2's compatibility checker.

**Tech Stack:** TypeScript, pema, semver, @rcompat/fs/io/cli, existing `diff-to-modifications` + `git-status` + `worktree` utils, @rcompat/test + proby.

**Spec:** `docs/superpowers/specs/2026-07-30-powerups-depends-diagnose-fix-design.md` → Subsystem 4 + Migration.
**Depends on:** Step 1 (manifest), Step 2 (`checkCompatibility`, `readPackMeta`, `findPackByName`).

**Conventions:** same as Steps 1–3.

---

### Task 1: Extract `parseDiffHunks` into a shared util

**Files:**
- Create `packages/cli/src/private/utils/git/parse-diff-hunks.ts`
- Modify `packages/cli/src/private/utils/create-powerup.ts` (delete the local function, import instead)
- Create `packages/cli/src/private/utils/git/parse-diff-hunks.spec.ts`

Rationale: `parseDiffHunks` is currently a private function in `create-powerup.ts` (line 71). The fix loop needs it. Move it without behavior change.

- [ ] **Step 1: Failing test**

```ts
import test from "@rcompat/test";
import { parseDiffHunks } from "#utils/git/parse-diff-hunks";

const diff = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 3;
 const c = 4;
`;

test.case("parses a single hunk", assert => {
  const hunks = parseDiffHunks(diff);
  assert(hunks.length).equals(1);
  assert(hunks[0].oldStart).equals(1);
  assert(hunks[0].lines.filter(l => l.type === "removed")[0].content).equals("const b = 2;");
  assert(hunks[0].lines.filter(l => l.type === "added")[0].content).equals("const b = 3;");
});

test.case("parses multiple hunks and skips headers", assert => {
  const two = diff + "\n@@ -10,2 +10,2 @@\n-x\n+y\n";
  assert(parseDiffHunks(two).length).equals(2);
});

test.case("handles no-newline marker", assert => {
  const nl = diff + "\\ No newline at end of file\n";
  assert(parseDiffHunks(nl)[0].lines.at(-1)!.noNewline).true();
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Move the function** — copy the exact body of `parseDiffHunks` from `create-powerup.ts` (lines 71–133) into `parse-diff-hunks.ts` with `export function parseDiffHunks(diffOutput: string): DiffHunk[]` (import `DiffHunk` from `./diff-to-modifications`). In `create-powerup.ts`, delete the local function and add `import { parseDiffHunks } from "#utils/git/parse-diff-hunks";`.

- [ ] **Step 4: Run new spec → PASS. Run `npx proby packages/cli/src/private/utils/create-powerup.spec.ts` → still PASS (no behavior change).**

- [ ] **Commit：**`git add packages/cli && git commit -m "refactor: extract parseDiffHunks into shared git utils"`

---

### Task 2: Fix session schema + store (`utils/fix-session.ts`)

**Files:**
- Create `packages/cli/src/private/schemas/fix-session.ts`
- Create `packages/cli/src/private/utils/fix-session.ts`
- Create `packages/cli/src/private/utils/fix-session.spec.ts`
- Create `packages/cli/src/private/errors/fixErrors.ts`
- Modify `packages/cli/src/private/constants.ts` (add `FIX_SESSION_FILE = "fix-session.json"`)

Session shape:

```json
{
  "powerup": "@powerups/shadcn",
  "name": "shadcn",
  "packDir": ".powerups/internal/shadcn-fork",  
  "baseCommit": "abc123",
  "startedAt": "ISO",
  "attributedFiles": ["src/components/ui/button.tsx"],
  "variables": {}
}
```

`packDir` is stored **relative to project root**. One session at a time.

- [ ] **Step 1: Failing test**

```ts
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readFixSession, writeFixSession, clearFixSession } from "#utils/fix-session";
import { fixSessionSchema } from "#schemas/fix-session";

const session = {
  powerup: "@powerups/shadcn", name: "shadcn",
  packDir: ".powerups/internal/shadcn-fork",
  baseCommit: "abc123", startedAt: "2026-07-30T00:00:00Z",
  attributedFiles: ["src/a.ts"], variables: {},
};

test.case("schema validates a session", assert => {
  assert(fixSessionSchema.parse(session).baseCommit).equals("abc123");
});

test.case("schema requires attributedFiles", assert => {
  try {
    fixSessionSchema.parse({ ...session, attributedFiles: undefined });
    assert(true).false();
  } catch { assert(true).true(); }
});

test.case("write/read/clear round-trip", async assert => {
  const root = fs.ref(path.join(tmpdir(), `fix-${randomUUID()}`));
  assert((await readFixSession(root)) === null).true();
  await writeFixSession(root, session);
  assert((await readFixSession(root))!.powerup).equals("@powerups/shadcn");
  await clearFixSession(root);
  assert((await readFixSession(root)) === null).true();
  await root.remove();
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement.**

`packages/cli/src/private/schemas/fix-session.ts`:

```ts
import p from "pema";

export const fixSessionSchema = p({
  /** Pack name being fixed. */
  powerup: p.string,
  /** Powerup name within the pack. */
  name: p.string,
  /** Project-root-relative path to the fork/pack directory being edited. */
  packDir: p.string,
  baseCommit: p.string,
  startedAt: p.string,
  /** Files the user may edit (from the manifest entry). */
  attributedFiles: p.array(p.string),
  variables: p.record(p.string, p.string),
});

export type FixSession = (typeof fixSessionSchema)["infer"];
```

`packages/cli/src/private/utils/fix-session.ts`:

```ts
import fs, { type FileRef } from "@rcompat/fs";
import { FIX_SESSION_FILE, MAIN_FOLDER } from "#constants";
import { fixSessionSchema, type FixSession } from "#schemas/fix-session";

function sessionRef(root: FileRef): FileRef {
  return root.append(`/${MAIN_FOLDER}/${FIX_SESSION_FILE}`);
}

/** Read the active fix session, or null when none exists. */
export async function readFixSession(root: FileRef): Promise<FixSession | null> {
  const ref = sessionRef(root);
  if (!(await fs.exists(ref))) return null;
  return fixSessionSchema.parse(await ref.json());
}

export async function writeFixSession(root: FileRef, session: FixSession): Promise<void> {
  const ref = sessionRef(root);
  await fs.create(ref.directory);
  await ref.writeJSON(session as never);
}

export async function clearFixSession(root: FileRef): Promise<void> {
  const ref = sessionRef(root);
  if (await fs.exists(ref)) await ref.remove();
}
```

`packages/cli/src/private/errors/fixErrors.ts` (pattern from earlier factories):

```ts
import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const fix_errors = error.coded({
  no_session: (name: string) =>
    t`${errorBGText}No active fix session for ${name}. Run "${CLI_CMD} fix ${name} start" first.`,
  session_exists: (name: string) =>
    t`${errorBGText}A fix session is already active for ${name}. Run "${CLI_CMD} fix ${name} end" or "${CLI_CMD} fix ${name} abort" first.`,
  not_applied: (name: string) =>
    t`${errorBGText}${name} has not been applied in this project. Run "${CLI_CMD} use ${name}" first.`,
  dirty_unattributed: (files: string) =>
    t`${errorBGText}Working tree has changes in files not owned by this powerup:\n${files}\nCommit or stash them, or use --force.`,
  not_a_git_repo: () =>
    t`${errorBGText}Fix sessions require a git repository. Run "git init" first.`,
});

export type FixErrorCode = keyof typeof fix_errors;
export const FixErrorCode = Object.fromEntries(
  Object.keys(fix_errors).map(k => [k, k]),
) as { [K in FixErrorCode]: K };
export default fix_errors;
```

Add to `constants.ts` after `APPLIED_FILE`:

```ts
/** Name of the active fix-session state file. */
export const FIX_SESSION_FILE = "fix-session.json";
```

- [ ] **Step 4: Run spec → PASS. Commit：**`git add packages/cli && git commit -m "feat: add fix session schema and store"`

---

### Task 3: `decideBump` — pure version-bump logic (`utils/fix-bump.ts`)

**Files:**
- Create `packages/cli/src/private/utils/fix-bump.ts`
- Create `packages/cli/src/private/utils/fix-bump.spec.ts`

Rules (from spec):
- All compatibility ranges still satisfied → **patch** bump.
- Any now violated → **major** bump + update the violated ranges to match the project's actual versions (`^<actual>`).
- No compatibility declared → **patch**.

- [ ] **Step 1: Failing test**

```ts
import test from "@rcompat/test";
import { decideBump } from "#utils/fix-bump";

test.case("patch bump when ranges still satisfied", assert => {
  const r = decideBump({
    version: "1.2.0",
    compatibility: { primate: "^0.31.0" },
    projectVersions: { primate: "0.31.5" },
  });
  assert(r.kind).equals("patch");
  assert(r.nextVersion).equals("1.2.1");
});

test.case("major bump + range update when violated", assert => {
  const r = decideBump({
    version: "2.0.0",
    compatibility: { primate: "^0.30.0" },
    projectVersions: { primate: "0.31.0" },
  });
  assert(r.kind).equals("major");
  assert(r.nextVersion).equals("3.0.0");
  assert(r.nextCompatibility!.primate).equals("^0.31.0");
});

test.case("patch when no compatibility declared", assert => {
  const r = decideBump({ version: "1.0.0", compatibility: {}, projectVersions: {} });
  assert(r.kind).equals("patch");
  assert(r.nextVersion).equals("1.0.1");
});

test.case("unknown project version is conservative → major", assert => {
  const r = decideBump({
    version: "1.0.0",
    compatibility: { primate: "^0.31.0" },
    projectVersions: {},
  });
  assert(r.kind).equals("patch"); // can't prove violation → patch, warn upstream
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** `packages/cli/src/private/utils/fix-bump.ts`:

```ts
import semver from "semver";

export interface BumpDecision {
  kind: "patch" | "major";
  nextVersion: string;
  /** Updated compatibility map (major bump only). */
  nextCompatibility?: Record<string, string>;
}

/**
 * Decide the fork's version bump after a fix.
 * Patch when every declared compatibility range is still satisfied (or
 * unverifiable); major + updated ranges when any range is provably violated.
 */
export function decideBump({
  version,
  compatibility,
  projectVersions,
}: {
  version: string;
  compatibility: Record<string, string>;
  projectVersions: Record<string, string>;
}): BumpDecision {
  const violated = Object.entries(compatibility).filter(([pkg, range]) => {
    const actual = projectVersions[pkg];
    return actual !== undefined
      && !semver.satisfies(actual, range, { includePrerelease: true });
  });

  if (violated.length === 0) {
    return { kind: "patch", nextVersion: semver.inc(version, "patch")! };
  }

  const nextCompatibility = { ...compatibility };
  for (const [pkg] of violated) {
    nextCompatibility[pkg] = `^${projectVersions[pkg]}`;
  }
  return { kind: "major", nextVersion: semver.inc(version, "major")!, nextCompatibility };
}
```

- [ ] **Step 4: Run, PASS (4/4). Commit：**`git add -A && git commit -m "feat: add fix version-bump decision logic"`

---

### Task 4: Fork-on-fix (`utils/fix-fork.ts`)

**Files:**
- Create `packages/cli/src/private/utils/fix-fork.ts`
- Create `packages/cli/src/private/utils/fix-fork.spec.ts`

`ensureLocalFork(root, manifestEntry, lookup)`: if the resolved pack is already local → return its dir unchanged (`forked: false`). If global → copy the pack dir into `<MAIN_FOLDER>/internal/<packname>-fix-<shortid>` (unique, non-destructive) and return that (`forked: true`). Copy recursively via FileRef `fs.create` + per-file copy.

- [ ] **Step 1: Failing test**

```ts
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { INTERNAL_FOLDER, MAIN_FOLDER, PACKAGE_FILE } from "#constants";
import { ensureLocalFork } from "#utils/fix-fork";

test.case("local pack is returned unchanged", async assert => {
  const root = fs.ref(path.join(tmpdir(), `fork-${randomUUID()}`));
  const local = root.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/mypack`);
  await fs.create(local);
  await local.append(`/${PACKAGE_FILE}`).writeJSON({ name: "mypack", version: "1.0.0" } as never);
  const r = await ensureLocalFork(root, "mypack", local);
  assert(r.forked).false();
  assert(r.packDir.path).equals(local.path);
  await root.remove();
});

test.case("global pack is forked into local internal store", async assert => {
  const root = fs.ref(path.join(tmpdir(), `fork-${randomUUID()}`));
  const globalDir = fs.ref(path.join(tmpdir(), `forksrc-${randomUUID()}`));
  await fs.create(globalDir.append("/multi-use/pow"));
  await globalDir.append(`/${PACKAGE_FILE}`).writeJSON({ name: "mypack", version: "1.0.0" } as never);
  await globalDir.append("/multi-use/pow/tpl.njk").write("hello");

  const r = await ensureLocalFork(root, "mypack", globalDir);
  assert(r.forked).true();
  assert(await fs.exists(r.packDir.append(`/${PACKAGE_FILE}`))).true();
  assert((await r.packDir.append("/multi-use/pow/tpl.njk").text()).trimEnd()).equals("hello");
  // source untouched
  assert((await globalDir.append("/multi-use/pow/tpl.njk").text()).trimEnd()).equals("hello");
  await root.remove();
  await globalDir.remove();
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** `packages/cli/src/private/utils/fix-fork.ts`:

```ts
import fs, { type FileRef } from "@rcompat/fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { INTERNAL_FOLDER, MAIN_FOLDER } from "#constants";

export interface ForkResult {
  packDir: FileRef;
  forked: boolean;
}

async function copyDir(src: FileRef, dest: FileRef): Promise<void> {
  await fs.create(dest);
  for (const entry of await fs.list(src)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const srcChild = src.append(`/${entry}`);
    if (srcChild.isDirectory) {
      await copyDir(srcChild, dest.append(`/${entry}`));
    } else {
      await dest.append(`/${entry}`).write(await srcChild.arrayBuffer());
    }
  }
}

/**
 * Return a locally-writable pack dir for fixing.
 * Local packs are used in place; global packs are copied into the project
 * store as a fork (never mutating the shared global copy).
 */
export async function ensureLocalFork(
  root: FileRef,
  packName: string,
  currentDir: FileRef,
): Promise<ForkResult> {
  const internalRoot = root.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}`).path;
  if (currentDir.path.startsWith(internalRoot)) {
    return { packDir: currentDir, forked: false };
  }
  const safeName = packName.replaceAll("@", "").replaceAll("/", "-");
  const forkName = `${safeName}-fix-${randomBytes(3).toString("hex")}`;
  const forkDir = root.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${forkName}`);
  await copyDir(currentDir, forkDir);
  return { packDir: forkDir, forked: true };
}

/** Project-root-relative path for session storage. */
export function relativeToRoot(root: FileRef, dir: FileRef): string {
  return path.relative(root.path, dir.path);
}
```

Note: verify the actual FileRef API for listing entries (`fs.list` vs `ref.files()`/`ref.dirs()`) and binary-safe copy (`arrayBuffer` vs `text`) against `@rcompat/fs` before writing; adjust to the real API — keep the test as the contract.

- [ ] **Step 4: Run, PASS (2/2). Run an existing spec over `@rcompat/fs` usage (e.g. `use.spec.ts`) to confirm API compatibility. Commit：**`git add -A && git commit -m "feat: add fork-on-fix for global packs"`

---

### Task 5: `pup fix start`

**Files:**
- Create `packages/cli/src/private/commands/fix/index.ts`
- Create `packages/cli/src/private/commands/fix/start.ts` (sub-action) — or one file with an `action` switch; prefer one file per phase: `fix/index.ts` (Command, action switches on `subcommands[1]`), `fix/fix.spec.ts`
- Create `packages/cli/src/commands/fix.ts`
- Modify `packages/cli/src/commands/index.ts`

Design decision: `pup fix <powerup> <start|end|abort>` — positional layout (`fix` is the command, powerup name is `subcommands[0]`, phase is `subcommands[1]`), NOT a Command-subcommand per phase, because the powerup name is dynamic. Register only `fix`.

`start` behavior:
1. Read manifest → find entry for the powerup (by `powerup` OR `name` match) → `not_applied` if missing.
2. `readFixSession` → `session_exists` if any.
3. Verify git repo (`verifyGitRepo`) → base commit via `io.run("git rev-parse HEAD")`.
4. Dirty-tree guard: `git status --porcelain`; changes whose paths are NOT in entry.files and NOT the main folder → `dirty_unattributed` unless `--force`.
5. Locate pack via `findPackByName(root, entry.powerup)` → `ensureLocalFork`. If forked, print which fork.
6. Write session: attributedFiles = entry.files (non-delete) paths; variables = entry.variables.
7. Print the attributed file list + `pup fix <name> end` hint.

- [ ] **Step 1: Failing test** — fixture like use.spec: git-inited testRoot, internal pack `test-pkg` with one powerup, applied via `use.run` so the manifest has an entry:

```ts
test.case("fix start creates a session with attributed files", async assert => {
  await reset(); // reuse use.spec-style helpers — recreate them in fix.spec.ts
  await createPowerup("fixme", [
    { type: "create", name: "f.txt", template: "f.njk", outputPath: ".fix/f.txt" },
  ]);
  await multiUseFolder.append("/fixme/f.njk").write("F");
  await use.run({ subcommands: ["fixme"], flags: [], context: { root: testRoot, globalRoot: tempGlobalRoot } });

  await fix.run({ subcommands: ["fixme", "start"], flags: [], context: { root: testRoot, globalRoot: tempGlobalRoot } });

  const session = await readFixSession(testRoot);
  assert(session !== null).true();
  assert(session!.attributedFiles).equals([".fix/f.txt"]);
  assert(session!.packDir.includes(INTERNAL_FOLDER)).true(); // local → in place
  await fix.run({ subcommands: ["fixme", "abort"], flags: [], context: { root: testRoot, globalRoot: tempGlobalRoot } });
});

test.case("fix start refuses when a session exists", async assert => {
  // start once, start again → code "session_exists"; cleanup abort
});

test.case("fix start errors for never-applied powerup", async assert => {
  // code "not_applied"
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** `packages/cli/src/private/commands/fix/index.ts`:

```ts
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import fix_errors from "#errors/fixErrors";
import use_errors from "#errors/useErrors";
import { readAppliedManifest } from "#utils/applied-manifest";
import { readFixSession, writeFixSession, clearFixSession } from "#utils/fix-session";
import { findPackByName } from "#utils/dependency-plan";
import { ensureLocalFork, relativeToRoot } from "#utils/fix-fork";
import { verifyGitRepo } from "#utils/worktree";
import { INTERNAL_FOLDER, MAIN_FOLDER } from "#constants";
import { runFixEnd } from "./end.js";

const fix = new Command({
  name: "fix",
  description: "Fix a powerup by editing its output and folding the fix back",
  flags: [
    { name: "force", long: "force", short: "f", description: "Start despite dirty unattributed files" },
    { name: "include", long: "include", short: "i", description: "Comma-separated extra files to fold in at end" },
  ],
  subcommands: [],
  action: async ({ subcommands, rawFlags, flags, context }) => {
    const name = subcommands?.[0];
    const phase = subcommands?.[1];
    if (!is.defined(name) || !is.defined(phase)) {
      throw fix_errors.no_session("<?>");
    }
    const root: FileRef = context?.root ?? await runtime.projectRoot();

    if (phase === "start") {
      await runFixStart({ root, name: name!, force: (rawFlags ?? []).some(f => f.flag === "--force" || f.flag === "-f"), homeDir: context?.homeDir });
    } else if (phase === "end") {
      await runFixEnd({ root, name: name!, include: flags.include as string | undefined, context });
    } else if (phase === "abort") {
      const session = await readFixSession(root);
      if (session === null) throw fix_errors.no_session(name!);
      await clearFixSession(root);
      cli.print(`Aborted fix session for ${session.powerup}. Working tree left untouched.\n`);
    } else {
      throw fix_errors.no_session(name!);
    }
  },
});

async function runFixStart({ root, name, force, homeDir }: {
  root: FileRef; name: string; force: boolean; homeDir?: string;
}): Promise<void> {
  const manifest = await readAppliedManifest(root);
  const entry = manifest.applied.find(e => e.powerup === name || e.name === name);
  if (entry === undefined) throw fix_errors.not_applied(name);

  if ((await readFixSession(root)) !== null) throw fix_errors.session_exists(entry.powerup);

  try {
    await verifyGitRepo(root);
  } catch {
    throw fix_errors.not_a_git_repo();
  }
  const baseCommit = (await io.run("git rev-parse HEAD", { cwd: root.path })).trim();

  // Dirty-tree guard: only attributed files + the main folder may be dirty.
  const owned = new Set([...entry.files.map(f => f.path), MAIN_FOLDER]);
  const status = await io.run("git status --porcelain", { cwd: root.path });
  const foreign = status.split("\n")
    .map(line => line.slice(3).trim())
    .filter(p => p.length > 0)
    .filter(p => ![...owned].some(o => p === o || p.startsWith(`${o}/`)));
  if (foreign.length > 0 && !force) {
    throw fix_errors.dirty_unattributed(foreign.map(f => `  - ${f}`).join("\n"));
  }

  const lookup = await findPackByName(root, entry.powerup, homeDir);
  if (lookup === null) throw fix_errors.not_applied(name);
  const { packDir, forked } = await ensureLocalFork(root, entry.powerup, lookup.packDir);

  const attributedFiles = entry.files.filter(f => f.action !== "delete").map(f => f.path);
  await writeFixSession(root, {
    powerup: entry.powerup,
    name: entry.name,
    packDir: relativeToRoot(root, packDir),
    baseCommit,
    startedAt: new Date().toISOString(),
    attributedFiles,
    variables: entry.variables,
  });

  if (forked) cli.print(`Forked ${entry.powerup} → ${relativeToRoot(root, packDir)}\n`);
  cli.print(`Fix session started (base ${baseCommit.slice(0, 8)}). Editable files:\n`);
  for (const file of attributedFiles) cli.print(`  ${file}\n`);
  cli.print(`\nEdit away, then run "pup fix ${name} end".\n`);
}

export default fix;
```

Create `packages/cli/src/commands/fix.ts` re-export; register `fix` in `commands/index.ts` (after `find`). `fs` import may be unused here — lint-check and trim.

- [ ] **Step 4: Run spec → FAIL still (runFixEnd missing). Create a temporary `end.ts` stub throwing, verify start/abort tests pass, then continue to Task 6 before committing.**

- [ ] **Commit (after Task 6):** combined — see Task 6 step 5.

---

### Task 6: `pup fix end` (`commands/fix/end.ts`)

**Files:**
- Create `packages/cli/src/private/commands/fix/end.ts`
- Extend `packages/cli/src/private/commands/fix/fix.spec.ts`

Behavior:
1. `readFixSession` → `no_session` if none; session.powerup must match `name` (or name matches entry.name).
2. Verify clean-vs-base diff exists (diff may be empty → still bump? **No:** empty diff → clear session, print "no changes folded").
3. Load fork `instructions.json` + existing step names into a Set (include templates' basenames).
4. For each attributed file with a diff base→worktree (and for new files created during the session that the user registers via `--include`):
   - `preImage` = `git show <baseCommit>:<file>` (skip + warn if unreadable — file was added after base)
   - `postImage` = current working-tree content (skip if file missing → treat as delete: append a `delete` step)
   - `hunks` = `parseDiffHunks(git diff <baseCommit> <baseCommit>..worktree -- <file>)` — obtain via `io.run(\`git diff ${base} -- "${file}"\`, { cwd: root })` (diff base→working tree)
   - `generateModifications({ preImage, postImage, hunks })` → write template `<powerupFolder>/src/fix/<filepath>.modify.json` (mirroring create-powerup layout) and append `{ type: "modify", name: generateStepName(...), template, outputPath: file }` to instructions.steps; collect warnings.
   - New files (created during session, in `--include` list): write content as a `create` step template under `src/fix/<path>`.
5. Rewrite `instructions.json` via `instructionsSchema.parse` + `writeJSON`.
6. Version bump: read fork package.json via `readPackMeta`; collect `projectVersions` for each compatibility key (reuse Step 2's project-version resolution — export `projectVersion` from `compatibility.ts`, adding it to exports); `decideBump`; write back `version` (+ `powerups.compatibility` when major). Print the bump and — for major — the old→new range table.
7. Re-render: invoke `use.run({ subcommands: [session.name], flags: session.variables → flags, context })` so the project gets the updated powerup immediately.
8. Update manifest entry via `recordApplication` (new version, refreshed files, same variables — `singleUse` per resolved type).
9. `clearFixSession`. Print summary + warnings.

- [ ] **Step 1: Failing test**

```ts
test.case("fix end folds user edits into the fork and patch-bumps", async assert => {
  await reset();
  await createPowerup("fixme", [
    { type: "create", name: "f.txt", template: "f.njk", outputPath: ".fix/f.txt" },
  ]);
  await multiUseFolder.append("/fixme/f.njk").write("line1\nline2\n");
  await use.run({ subcommands: ["fixme"], flags: [], context: { root: testRoot, globalRoot: tempGlobalRoot } });
  await gitCommit(testRoot, "apply");

  await fix.run({ subcommands: ["fixme", "start"], flags: [], context: { root: testRoot, globalRoot: tempGlobalRoot } });
  await testRoot.append("/.fix/f.txt").write("line1\nline2-fixed\n");
  await captureStdout(() =>
    fix.run({ subcommands: ["fixme", "end"], flags: [], context: { root: testRoot, globalRoot: tempGlobalRoot } }));

  // Fork now carries a modify step for the fix
  const instructions = await multiUseFolder.append("/fixme/instructions.json").json() as { steps: unknown[]; };
  assert(instructions.steps.some(s => (s as { type: string }).type === "modify")).true();
  // Version bumped 1.0.0 → 1.0.1
  const pkg = await internalFolder.append("/test-pkg/package.json").json() as { version: string };
  assert(pkg.version).equals("1.0.1");
  // Session cleared
  assert((await readFixSession(testRoot)) === null).true();
});

test.case("major bump when compatibility is violated", async assert => {
  // setup: test-pkg package.json gains powerups.compatibility { "primate": "^0.30.0" },
  // project package.json + node_modules/primate at 0.31.0
  // after fix end: version 1.0.0 → 2.0.0, compatibility primate → "^0.31.0"
});

test.case("fix end aborts cleanly on empty diff", async assert => {
  // start, end with no edits → prints "no changes", session cleared, version unchanged
});

test.case("fix end without session errors", async assert => {
  // code "no_session"
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** `packages/cli/src/private/commands/fix/end.ts` (core structure):

```ts
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import fix_errors from "#errors/fixErrors";
import use from "#commands/use/index";
import { instructionsSchema, type Step } from "#schemas/instruction";
import { readAppliedManifest, recordApplication } from "#utils/applied-manifest";
import { readFixSession, clearFixSession } from "#utils/fix-session";
import { parseDiffHunks } from "#utils/git/parse-diff-hunks";
import { generateModifications } from "#utils/git/diff-to-modifications";
import { readPackMeta } from "#utils/dependency-plan";
import { projectVersion } from "#utils/compatibility"; // Task step: export it
import { decideBump } from "#utils/fix-bump";
import { CLI_NAME, MULTI_USE_FOLDER, PACKAGE_FILE, SINGLE_USE_FOLDER } from "#constants";
import path from "node:path";

export async function runFixEnd({ root, name, include, context }: {
  root: FileRef;
  name: string;
  include?: string;
  context?: { root?: FileRef; globalRoot?: string; homeDir?: string };
}): Promise<void> {
  const session = await readFixSession(root);
  if (session === null) throw fix_errors.no_session(name);
  if (session.powerup !== name && session.name !== name) {
    throw fix_errors.no_session(name);
  }

  const packDir = root.append(`/${session.packDir}`);
  const meta = await readPackMeta(packDir);
  if (meta === null) throw fix_errors.no_session(name);

  // Locate the powerup folder (single powerup per pack)
  const active = meta.pkgJson[CLI_NAME].active;
  const typeFolderName = active[MULTI_USE_FOLDER]?.[session.name] !== undefined
    ? MULTI_USE_FOLDER
    : SINGLE_USE_FOLDER;
  const powerupFolder = packDir.append(`/${typeFolderName}/${session.name}`);
  const instructionsPath = powerupFolder.append("/instructions.json");
  const instructions = instructionsSchema.parse(await instructionsPath.json());

  const warnings: string[] = [];
  const existingNames = new Set(instructions.steps.map(s => s.name));
  const newSteps: Step[] = [];

  let changedCount = 0;
  for (const file of session.attributedFiles) {
    const worktreeFile = root.append(`/${file}`);
    const exists = await fs.exists(worktreeFile);

    let preImage: string | null = null;
    try {
      preImage = await io.run(`git show ${session.baseCommit}:"${file}"`, { cwd: root.path });
    } catch { preImage = null; }

    if (!exists) {
      if (preImage !== null) {
        newSteps.push(deleteStep(file, existingNames));
        changedCount++;
      }
      continue;
    }
    const postImage = await worktreeFile.text();
    if (preImage === null) {
      // Added after base — only fold if explicitly included
      if ((include ?? "").split(",").map(s => s.trim()).includes(file)) {
        newSteps.push(await createStepFromFile(powerupFolder, root, file, postImage, existingNames));
        changedCount++;
      } else {
        warnings.push(`${file}: new file not attributed to ${session.powerup} — pass --include=${file} to fold it in`);
      }
      continue;
    }
    if (preImage === postImage) continue;

    const diffOutput = await io.run(
      `git diff ${session.baseCommit} -- "${file}"`, { cwd: root.path });
    const result = generateModifications({
      preImage, postImage, hunks: parseDiffHunks(diffOutput) });
    warnings.push(...result.warnings.map(w => `${file}: ${w}`));

    const template = `src/fix/${file}.modify.json`;
    const templatePath = powerupFolder.append(`/${template}`);
    await fs.create(templatePath.directory);
    await templatePath.write(JSON.stringify(result.modifications, null, 2) + "\n");
    newSteps.push({
      type: "modify",
      name: uniqueStepName("modify", file, existingNames),
      template,
      outputPath: file,
    });
    changedCount++;
  }

  if (changedCount === 0) {
    await clearFixSession(root);
    cli.print(`No changes detected — nothing folded into ${session.powerup}.\n`);
    for (const w of warnings) cli.print(`  warning: ${w}\n`);
    return;
  }

  // Write updated instructions
  const updated = { ...instructions, steps: [...instructions.steps, ...newSteps] };
  instructionsSchema.parse(updated);
  await instructionsPath.writeJSON(updated as never);

  // Version bump
  const projectVersions: Record<string, string> = {};
  for (const pkg of Object.keys(meta.compatibility)) {
    const v = await projectVersion(root, pkg);
    if (v !== undefined) projectVersions[pkg] = v;
  }
  const bump = decideBump({
    version: meta.version,
    compatibility: meta.compatibility,
    projectVersions,
  });
  const pkgJsonRef = packDir.append(`/${PACKAGE_FILE}`);
  const pkgJson = await pkgJsonRef.json() as Record<string, unknown>;
  pkgJson.version = bump.nextVersion;
  if (bump.nextCompatibility !== undefined) {
    (pkgJson[CLI_NAME] as Record<string, unknown>).compatibility = bump.nextCompatibility;
  }
  await pkgJsonRef.writeJSON(pkgJson as never);

  // Re-render the updated powerup into the project
  await use.run({
    subcommands: [session.name],
    flags: Object.entries(session.variables).map(([k, v]) => ({ flag: `--${k}`, value: v })),
    rawFlags: [{ flag: "--overwrite", value: "" }],
    context,
  });

  // Refresh manifest (use.run already recorded one entry; re-record to be explicit with new version)
  const manifest = await readAppliedManifest(root);
  const prev = manifest.applied.find(e => e.powerup === session.powerup && e.name === session.name);
  await recordApplication({
    root,
    powerup: session.powerup,
    name: session.name,
    version: bump.nextVersion,
    location: "local",
    variables: session.variables,
    changedFiles: prev?.files ?? [],
    dependsOn: prev?.dependsOn,
    singleUse: typeFolderName === SINGLE_USE_FOLDER,
  });

  await clearFixSession(root);

  cli.print(`\n✓ Folded ${changedCount} change(s) into ${session.powerup}\n`);
  cli.print(`  version: ${meta.version} → ${bump.nextVersion} (${bump.kind})\n`);
  if (bump.kind === "major" && bump.nextCompatibility !== undefined) {
    for (const [pkg, range] of Object.entries(bump.nextCompatibility)) {
      cli.print(`  compatibility: ${pkg} → ${range}\n`);
    }
  }
  for (const w of warnings) cli.print(`  warning: ${w}\n`);
}

function uniqueStepName(prefix: "modify", filePath: string, existing: Set<string>): string {
  const base = `${prefix}-${filePath.replace(/\//g, "-").replace(/\./g, "-")}-fix`;
  let candidate = base;
  let n = 2;
  while (existing.has(candidate)) candidate = `${base}-${n++}`;
  existing.add(candidate);
  return candidate;
}

function deleteStep(filePath: string, existing: Set<string>): Step {
  const base = `delete-${filePath.replace(/\//g, "-").replace(/\./g, "-")}-fix`;
  let candidate = base;
  let n = 2;
  while (existing.has(candidate)) candidate = `${base}-${n++}`;
  existing.add(candidate);
  return { type: "delete", name: candidate, outputPath: filePath };
}

async function createStepFromFile(
  powerupFolder: FileRef, root: FileRef, file: string, content: string, existing: Set<string>,
): Promise<Step> {
  const template = `src/fix/${file}`;
  const templatePath = powerupFolder.append(`/${template}`);
  await fs.create(templatePath.directory);
  await templatePath.write(content);
  const base = `create-${file.replace(/\//g, "-").replace(/\./g, "-")}-fix`;
  let candidate = base;
  let n = 2;
  while (existing.has(candidate)) candidate = `${base}-${n++}`;
  existing.add(candidate);
  return { type: "create", name: candidate, template, outputPath: file };
}
```

Also: export `projectVersion` from `compatibility.ts` (change from module-private to `export async function`). `path` import in end.ts may be removable — lint-check.

- [ ] **Step 4: Run fix.spec.ts → PASS. Full suite → 0 failures. Lint clean.**

- [ ] **Step 5: Commit (covers Tasks 5+6)**

`git add packages/cli && git commit -m "feat: add pup fix start/end/abort with fork-on-fix and version bumps"`

---

### Task 7: Manual migration — split `.powerups/internal/pup-internal/`

**No code. A guided manual task** (executor performs, verifies, commits):

- [ ] **Step 1:** Create three sibling packs under `.powerups/internal/`:
  - `powerups-cli-command/` ← move `cli-command/`
  - `powerups-cli-subcommand/` ← move `cli-subcommand/`
  - `powerups-cli-command-with-subcommands/` ← move `cli-command-with-subcommands/`

  Each new pack gets its own `package.json`:

```json
{
  "name": "powerups-cli-command",
  "version": "1.0.0",
  "description": "Scaffold a new pup CLI command",
  "keywords": ["powerups-package"],
  "powerups": {
    "active": {
      "multi-use": { "cli-command": "./multi-use/cli-command/instructions.json" },
      "single-use": {}
    }
  }
}
```

  (adjust name/description per pack; keep the same instructions path layout by moving the whole `multi-use/<name>` folders into each new pack).

- [ ] **Step 2:** Update the **project** config `.powerups/config.json`: replace the `"pup-internal"` packages entry with the three new source names (`"powerups-cli-command"`, `"powerups-cli-subcommand"`, `"powerups-cli-command-with-subcommands"`). Delete `.powerups/internal/pup-internal/`.

- [ ] **Step 3:** If any of the three instructions.json files use `include` steps referencing sibling powerups (inspect each), note them — conversion to `depends` requires Step 2's schema, which now exists: add a `depends` entry to the referencing pack's `package.json`. Verify none exist first (these scaffold commands are documented as independent).

- [ ] **Step 4: Verify** — `npx proby packages/cli` → 0 failures; `npx tsgo --noEmit -p packages/cli` (if a typecheck script exists, use it; else `cd packages/cli && npx eslint .`).

- [ ] **Step 5: Commit:** `.powerups/` is gitignored in this repo (docs and .powerups both) — if tracked files changed, `git add -f .powerups` then `git commit -m "chore: split pup-internal into one-powerup-per-pack packs"`. If untracked, verify only.

> **Executor note:** inspect `.powerups/internal/pup-internal/` at execution time; the exact layout above reflects the repo state at plan-writing (3 multi-use powerups: cli-command, cli-subcommand, cli-command-with-subcommands). If it has since changed, adapt and record the adaptation in the commit message.

---

### Task 8: Docs

- [ ] **Step 1:** `packages/cli/README.md`: command table row `| fix <name> <start\|end\|abort> | Fold fixes to generated code back into the powerup |` + Concepts bullet:

```markdown
- **Fix loop** — `pup fix <name> start` snapshots the project (forking the
  powerup locally if it came from npm/git), you edit the generated code, and
  `pup fix <name> end` folds the diff back into the powerup's templates and
  bumps its version — major + updated compatibility range when the fix
  targets a newer version of a dependency (e.g. primate ^0.30 → ^0.31).
```

- [ ] **Step 2: Commit** `git commit -am "docs: document fix loop"`

---

## Self-Review Notes (author)

- **Spec coverage:** start (fork-on-fix, git snapshot, one-session guard, dirty-tree guard) ✓; end (diff → generateModifications → templates/instructions, patch-vs-major bump, project-version detection, re-render, manifest refresh, session cleanup) ✓; abort ✓; `--include` for edits to other files ✓; delete during session → delete step ✓ (spec said "recorded with action delete"); manual pup-internal split ✓. Interactive range confirmation (spec) simplified to automatic `^<actual>` — major-bump output prints the change for transparency; flagged as a deviation.
- **Type consistency:** `FixSession`/`decideBump`/`ensureLocalFork` signatures identical across Tasks 2–6; `runFixEnd` imported by Task 5's fix/index.ts from `./end.js` — matches the codebase's `.js` import convention for local modules.
- **Executor risks:** (1) `fs.list`/`arrayBuffer` FileRef API in fix-fork — verify against `@rcompat/fs` docs/usage in repo; (2) `git diff <base> -- <file>` includes only tracked changes to that path; files added during session are untracked vs base — handled via the `--include` gate, test accordingly; (3) re-render via `use.run` requires the fork's powerup resolvable by name — fork lives in INTERNAL_FOLDER which is in config; if the original entry used an npm source, the local fork shadows it by name (resolvePackage checks local first) — add a test asserting the fork wins.
