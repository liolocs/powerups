# Step 3 — Diagnose & Blame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pup diagnose -- <cmd>` runs a failing command, parses file paths from its error output, maps them through the applied manifest, and reports which powerup(s) caused the failure. `pup blame <file>` shows which powerup wrote a file.

**Architecture:** One pure attribution engine (`utils/attribution.ts`) over the Step 1 manifest; one pure error-path extractor (`utils/error-paths.ts`) with fixture-driven regex parsing; two thin commands. `diagnose` wraps the child process with `io.run`, captures output, passes through the exit code. Unattributed files are reported honestly — never guessed.

**Tech Stack:** TypeScript, @rcompat/fs/io/cli, @rcompat/test + proby.

**Spec:** `docs/superpowers/specs/2026-07-30-powerups-depends-diagnose-fix-design.md` → Subsystem 3.
**Depends on:** Step 1 (manifest + `readAppliedManifest`). No Step 2 dependency.

**Conventions:** same as Steps 1–2 (error.coded factories, `@rcompat/test`, `npx proby <spec-path>` from repo root, `#*` alias).

---

### Task 1: Attribution engine (`utils/attribution.ts`)

**Files:**
- Create `packages/cli/src/private/utils/attribution.ts`
- Create `packages/cli/src/private/utils/attribution.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import test from "@rcompat/test";
import { attributeFiles, buildAttributionReport } from "#utils/attribution";
import type { AppliedManifest } from "#schemas/applied";

const manifest: AppliedManifest = {
  version: 1,
  applied: [
    {
      powerup: "@powerups/shadcn", name: "shadcn", version: "1.0.0",
      location: "global", appliedAt: "2026-07-30T10:00:00Z",
      variables: {},
      files: [
        { path: "src/components/ui/button.tsx", action: "create" },
        { path: "src/lib/utils.ts", action: "create" },
      ],
    },
    {
      powerup: "@powerups/base-init", name: "base-init", version: "2.0.0",
      location: "local", appliedAt: "2026-07-29T09:00:00Z",
      variables: {},
      files: [{ path: "src/app.ts", action: "create" }],
    },
    {
      powerup: "@powerups/cleanup", name: "cleanup", version: "1.0.0",
      location: "global", appliedAt: "2026-07-30T11:00:00Z",
      variables: {},
      files: [{ path: "src/app.ts", action: "modify" }],
    },
  ],
};

test.case("attributed file maps to its powerup, newest first", assert => {
  const result = attributeFiles(manifest, ["src/app.ts"]);
  const hits = result.attributed.get("src/app.ts")!;
  assert(hits.length).equals(2);
  assert(hits[0].powerup).equals("@powerups/cleanup"); // newest appliedAt first
});

test.case("unattributed files are separated", assert => {
  const result = attributeFiles(manifest, ["src/custom/thing.ts"]);
  assert(result.unattributed).equals(["src/custom/thing.ts"]);
});

test.case("files deleted by a powerup are not attributed to it", assert => {
  const m: AppliedManifest = {
    version: 1,
    applied: [{
      powerup: "@powerups/x", name: "x", version: "1.0.0", location: "local",
      appliedAt: "2026-07-30T00:00:00Z", variables: {},
      files: [{ path: "gone.ts", action: "delete" }],
    }],
  };
  const result = attributeFiles(m, ["gone.ts"]);
  assert(result.unattributed).equals(["gone.ts"]);
});

test.case("report groups by powerup with fix hints", assert => {
  const result = attributeFiles(manifest, ["src/components/ui/button.tsx", "src/custom/thing.ts"]);
  const report = buildAttributionReport(result);
  assert(report.includes("@powerups/shadcn@1.0.0")).true();
  assert(report.includes("src/components/ui/button.tsx")).true();
  assert(report.includes("pup fix @powerups/shadcn start")).true();
  assert(report.includes("Unattributed")).true();
  assert(report.includes("src/custom/thing.ts")).true();
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** `packages/cli/src/private/utils/attribution.ts`:

```ts
import type { AppliedEntry, AppliedManifest } from "#schemas/applied";

export interface AttributionResult {
  /** file path → matching entries, newest application first. */
  attributed: Map<string, AppliedEntry[]>;
  /** files written by no powerup. */
  unattributed: string[];
}

/**
 * Map file paths to the manifest entries that wrote them.
 * Delete-action file records never attribute (the file no longer exists).
 */
export function attributeFiles(
  manifest: AppliedManifest,
  paths: string[],
): AttributionResult {
  const attributed = new Map<string, AppliedEntry[]>();
  const unattributed: string[] = [];

  for (const filePath of paths) {
    const matches = manifest.applied
      .filter(entry => entry.files.some(
        file => file.path === filePath && file.action !== "delete"))
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
    if (matches.length > 0) attributed.set(filePath, matches);
    else unattributed.push(filePath);
  }
  return { attributed, unattributed };
}

/** Human-readable attribution report, powerup-grouped, with fix hints. */
export function buildAttributionReport(result: AttributionResult): string {
  const lines: string[] = [];
  if (result.attributed.size > 0) {
    lines.push("Failure attributed to powerups:", "");
    // group files by newest-matching powerup
    const byPowerup = new Map<string, { entry: AppliedEntry; files: string[] }>();
    for (const [filePath, entries] of result.attributed) {
      const entry = entries[0]!;
      const key = `${entry.powerup}@${entry.version}`;
      const group = byPowerup.get(key) ?? { entry, files: [] };
      group.files.push(filePath);
      byPowerup.set(key, group);
    }
    for (const [label, group] of byPowerup) {
      for (const file of group.files) lines.push(`  ${file}`);
      lines.push(
        `    ← ${label} (applied ${group.entry.appliedAt.slice(0, 10)})`,
        `    fix: pup fix ${group.entry.powerup} start`,
        "",
      );
    }
  }
  if (result.unattributed.length > 0) {
    lines.push(
      `Unattributed errors (${result.unattributed.length}) — files not written by any powerup:`,
      ...result.unattributed.map(file => `  ${file}`),
    );
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run, PASS (4/4). Commit：**`git add -A && git commit -m "feat: add attribution engine over applied manifest"`

---

### Task 2: Error-path extractor (`utils/error-paths.ts`)

**Files:**
- Create `packages/cli/src/private/utils/error-paths.ts`
- Create `packages/cli/src/private/utils/error-paths.spec.ts`

Extracts project-relative file paths from: node/bun stack frames, tsc errors, ESLint output, vite/webpack "ERROR in ./path" lines, and `path:line:col` patterns. Filters noise (node_modules, `node:` builtins, URLs).

- [ ] **Step 1: Failing test**

```ts
import test from "@rcompat/test";
import { extractErrorPaths } from "#utils/error-paths";

test.case("node stack frame paths", assert => {
  const out = `Error: boom
    at render (src/components/ui/button.tsx:12:7)
    at App (/proj/src/app.ts:3:1)
    at node:internal/modules/run_main:23:11`;
  const paths = extractErrorPaths(out, "/proj");
  assert(paths.includes("src/components/ui/button.tsx")).true();
  assert(paths.includes("src/app.ts")).true();
  assert(paths.some(p => p.startsWith("node:"))).false();
});

test.case("tsc error format", assert => {
  const out = `src/lib/utils.ts(5,10): error TS2322: Type 'string' is not assignable.`;
  assert(extractErrorPaths(out, "/proj")).equals(["src/lib/utils.ts"]);
});

test.case("eslint format", assert => {
  const out = `/proj/src/app.ts
  3:7  error  'x' is not defined  no-undef`;
  assert(extractErrorPaths(out, "/proj")).equals(["src/app.ts"]);
});

test.case("generic path:line:col and noise filtering", assert => {
  const out = `failed at /proj/node_modules/pkg/index.js:1:1 and src/x.ts:9:3; see https://example.com/a.ts:1:1`;
  const paths = extractErrorPaths(out, "/proj");
  assert(paths).equals(["src/x.ts"]);
});

test.case("dedupes repeated paths preserving order", assert => {
  const out = `src/a.ts:1:1\nsrc/a.ts:2:5\nsrc/b.ts:1:1`;
  assert(extractErrorPaths(out, "/proj")).equals(["src/a.ts", "src/b.ts"]);
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** `packages/cli/src/private/utils/error-paths.ts`:

```ts
/**
 * Extract project-relative file paths from compiler/runtime error output.
 * Pure regex parsing — no filesystem access (parsing output for files that
 * were deleted since the error must still attribute).
 */
export function extractErrorPaths(output: string, projectRoot: string): string[] {
  const candidates: string[] = [];
  const patterns = [
    // node/bun stack frames: "at fn (path:line:col)" and bare "at path:line:col"
    /\bat\s+(?:[^\n()]*\()?((?:[A-Za-z]:)?[^\s():]+(?:\/|:)[^\s():]+):(\d+):(\d+)\)?/g,
    // tsc: path(line,col):
    /(^|\s)((?:[A-Za-z]:)?[\w./-]+\.[tj]sx?)\((\d+),(\d+)\):/gm,
    // generic path:line:col
    /(^|\s)((?:[A-Za-z]:)?[\w./-]+\.\w+):(\d+):(\d+)/gm,
    // webpack/vite: ERROR in ./path
    /ERROR in (.+)/g,
    // bare eslint file header line: an absolute path alone on a line
    /^((?:[A-Za-z]:)?\/[^\s:]+\.\w+)\s*$/gm,
  ];

  for (const pattern of patterns) {
    for (const match of output.matchAll(pattern)) {
      const raw = match[1];
      if (raw === undefined) continue;
      candidates.push(...normalize(raw, projectRoot));
    }
  }

  return [...new Set(candidates)];
}

function normalize(raw: string, projectRoot: string): string[] {
  let candidate = raw.trim();
  if (candidate.length === 0) return [];
  if (candidate.startsWith("node:") || candidate.startsWith("http")) return [];
  if (candidate.includes("node_modules")) return [];
  // absolute → project-relative
  if (candidate.startsWith(projectRoot)) {
    candidate = candidate.slice(projectRoot.length);
  }
  if (candidate.startsWith("/")) candidate = candidate.slice(1);
  if (candidate.startsWith("./")) candidate = candidate.slice(2);
  // must look like a real source path (has a dot-extension, no spaces)
  if (!/[\w/-]+\.\w{1,6}$/.test(candidate)) return [];
  return [candidate];
}
```

- [ ] **Step 4: Run, PASS (5/5). Commit：**`git add -A && git commit -m "feat: add error output path extractor"`

---

### Task 3: `diagnoseErrors` factory

**Files:** Create `packages/cli/src/private/errors/diagnoseErrors.ts`

- [ ] **Step 1: Implement:**

```ts
import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const diagnose_errors = error.coded({
  no_command: () => {
    const errorText =
      `No command to diagnose.\n\nUsage: ${CLI_CMD} diagnose -- <command>\n` +
      `Example: ${CLI_CMD} diagnose -- npm run dev`;
    return t`${errorBGText}${errorText}`;
  },
  missing_file: () => {
    const errorText = `File path required.\n\nUsage: ${CLI_CMD} blame <file>`;
    return t`${errorBGText}${errorText}`;
  },
});

export type DiagnoseErrorCode = keyof typeof diagnose_errors;
export const DiagnoseErrorCode = Object.fromEntries(
  Object.keys(diagnose_errors).map(k => [k, k]),
) as { [K in DiagnoseErrorCode]: K };
export default diagnose_errors;
```

- [ ] **Step 2: Commit：**`git add -A && git commit -m "feat: add diagnose error factory"`

---

### Task 4: `pup diagnose`

**Files:**
- Create `packages/cli/src/private/commands/diagnose/index.ts`
- Create `packages/cli/src/private/commands/diagnose/diagnose.spec.ts`
- Create `packages/cli/src/commands/diagnose.ts`
- Modify `packages/cli/src/commands/index.ts`

Behavior:
- `pup diagnose -- <cmd and args>`: everything after `--` (arrive as `subcommands` after the `--` marker — handle both: if `rawFlags` contains a literal `--`, take positionals; the Command framework passes trailing positionals into `subcommands`, and the raw `--` is stripped by the shell → verify with a manual run; if the framework doesn't support `--`, accept the command joined from `subcommands`).
- Join `subcommands` into the command string, run via `io.run` with `{ cwd: root.path }`, capturing both success and failure output. `io.run` throws on non-zero — catch and extract output from the error; also detect failure.
- Extract paths via `extractErrorPaths(output, root.path)`, read the manifest, attribute, print the report. If the command succeeded or no paths were found, say so plainly.
- **Exit code:** mirror the child command (`process.exitCode = childCode`) so it composes in scripts.
- `pup diagnose` with no command and no `--`: interactive-lite — list the 5 most recent manifest entries (newest first) with their files and a hint to use `-- <cmd>`; do NOT build a full prompt loop in this step (defer).

- [ ] **Step 1: Failing test** — fixture: project root with git init, main folder, manifest written via `writeAppliedManifest`, and a failing node one-liner referencing a real file:

```ts
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import io from "@rcompat/io";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import diagnose from "#commands/diagnose/index";
import { writeAppliedManifest } from "#utils/applied-manifest";
import captureStdout from "#test-utils/capture-stdout";
import { MAIN_FOLDER } from "#constants";

async function fixture() {
  const root = fs.ref(path.join(tmpdir(), `diagnose-${randomUUID()}`));
  await fs.create(root.append(`/${MAIN_FOLDER}`));
  await io.run("git init", { cwd: root.path });
  await root.append("/src/thing.ts").write("throw new Error('x')");
  await writeAppliedManifest(root, {
    version: 1,
    applied: [{
      powerup: "@powerups/widget", name: "widget", version: "1.2.0",
      location: "local", appliedAt: "2026-07-30T00:00:00Z", variables: {},
      files: [{ path: "src/thing.ts", action: "create" }],
    }],
  });
  return root;
}

test.case("diagnose attributes failing file to powerup", async assert => {
  const root = await fixture();
  const script = root.append("/fail.js");
  await script.write(`console.log("${root.path.replaceAll("\\", "/")}/src/thing.ts:1:1 bad"); process.exit(1);`);

  const original = process.exitCode;
  const output = await captureStdout(() =>
    diagnose.run({
      subcommands: ["node", script.path],
      context: { root, globalRoot: tmpdir() },
    }));
  assert(output.includes("@powerups/widget@1.2.0")).true();
  assert(output.includes("src/thing.ts")).true();
  assert(process.exitCode).equals(1);
  process.exitCode = original;
  await root.remove();
});

test.case("diagnose reports unattributed files honestly", async assert => {
  const root = await fixture();
  const script = root.append("/fail2.js");
  await script.write(`console.log("${root.path.replaceAll("\\", "/")}/src/other.ts:9:9 nope"); process.exit(2);`);
  const original = process.exitCode;
  const output = await captureStdout(() =>
    diagnose.run({
      subcommands: ["node", script.path],
      context: { root, globalRoot: tmpdir() },
    }));
  assert(output.includes("Unattributed")).true();
  assert(output.includes("src/other.ts")).true();
  process.exitCode = original;
  await root.remove();
});

test.case("diagnose with no args lists recent applications", async assert => {
  const root = await fixture();
  const output = await captureStdout(() =>
    diagnose.run({ subcommands: [], context: { root, globalRoot: tmpdir() } }));
  assert(output.includes("@powerups/widget")).true();
  await root.remove();
});
```

(`runtime` import in the fixture header is only needed if following other specs' projectRoot pattern for cleanup — drop if unused.)

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** `packages/cli/src/private/commands/diagnose/index.ts`:

```ts
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import diagnose_errors from "#errors/diagnoseErrors";
import { readAppliedManifest } from "#utils/applied-manifest";
import { attributeFiles, buildAttributionReport } from "#utils/attribution";
import { extractErrorPaths } from "#utils/error-paths";
import { MAIN_FOLDER } from "#constants";

const diagnose = new Command({
  name: "diagnose",
  description: "Run a command and attribute failures to the powerups that caused them",
  flags: [],
  subcommands: [],
  action: async ({ subcommands, context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    if (!(await fs.exists(root.append(`/${MAIN_FOLDER}`)))) {
      throw diagnose_errors.no_command();
    }
    const manifest = await readAppliedManifest(root);
    const command = (subcommands ?? []).join(" ").trim();

    // No command: list recent applications as a starting point.
    if (command.length === 0) {
      if (manifest.applied.length === 0) {
        cli.print(`No powerups applied yet. Run "pup use <name>" first.\n`);
        return;
      }
      const recent = [...manifest.applied]
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
        .slice(0, 5);
      cli.print("Recently applied powerups (newest first):\n");
      for (const entry of recent) {
        cli.print(`  ${entry.powerup}@${entry.version} — ${entry.appliedAt.slice(0, 10)}\n`);
        for (const file of entry.files) cli.print(`    ${file.path}\n`);
      }
      cli.print(`\nRun "pup diagnose -- <command>" to attribute a failure.\n`);
      return;
    }

    // Run the command, streaming output through, capturing output + exit code.
    let output = "";
    let exitCode = 0;
    try {
      const stdout = await io.run(command, { cwd: root.path });
      output += stdout;
      cli.print(stdout);
    } catch (error) {
      exitCode = 1;
      const message = error instanceof Error ? error.message : String(error);
      output += message;
      cli.print(message + "\n");
      const maybeCode = (error as { exitCode?: number }).exitCode;
      if (typeof maybeCode === "number") exitCode = maybeCode;
    }

    if (exitCode === 0) {
      cli.print(`\n✓ Command succeeded — nothing to diagnose.\n`);
      return;
    }

    const paths = extractErrorPaths(output, root.path);
    if (paths.length === 0) {
      cli.print(`\nCommand failed (exit ${exitCode}) but no file paths were found in its output.\n`);
      cli.print(`Recently applied: ${manifest.applied.map(e => e.powerup).slice(-3).join(", ") || "none"}\n`);
      process.exitCode = exitCode;
      return;
    }

    const result = attributeFiles(manifest, paths);
    const report = buildAttributionReport(result);
    cli.print(`\n${report}\n`);
    process.exitCode = exitCode;
  },
});

export default diagnose;
```

Create `packages/cli/src/commands/diagnose.ts`:

```ts
import diagnose from "../private/commands/diagnose/index.js";

export default diagnose;
```

Register in `packages/cli/src/commands/index.ts`: import + add `diagnose` to the array (alphabetical, before `doctor`).

- [ ] **Step 4: Run spec → PASS. Full suite `npx proby packages/cli` → 0 failures.**

- [ ] **Commit：**`git add packages/cli && git commit -m "feat: add pup diagnose command with failure attribution"`

---

### Task 5: `pup blame <file>`

**Files:**
- Create `packages/cli/src/private/commands/blame/index.ts`
- Create `packages/cli/src/private/commands/blame/blame.spec.ts`
- Create `packages/cli/src/commands/blame.ts`
- Modify `packages/cli/src/commands/index.ts`

- [ ] **Step 1: Failing test** (same fixture shape as Task 4):

```ts
import test from "@rcompat/test";
import blame from "#commands/blame/index";
/* same fs/tmpdir/io/git-fixture imports as diagnose.spec.ts */

test.case("blame shows attribution for an owned file", async assert => {
  const root = await fixture(); // manifest: src/thing.ts ← @powerups/widget@1.2.0, variables { name: "foo" }
  const output = await captureStdout(() =>
    blame.run({ subcommands: ["src/thing.ts"], context: { root, globalRoot: tmpdir() } }));
  assert(output.includes("@powerups/widget@1.2.0")).true();
  assert(output.includes("2026-07-30")).true();
  assert(output.includes("name=foo")).true();
  await root.remove();
});

test.case("blame handles unattributed files", async assert => {
  const root = await fixture();
  const output = await captureStdout(() =>
    blame.run({ subcommands: ["src/mine.ts"], context: { root, globalRoot: tmpdir() } }));
  assert(output.includes("not written by any powerup")).true();
  await root.remove();
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** `packages/cli/src/private/commands/blame/index.ts`:

```ts
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import diagnose_errors from "#errors/diagnoseErrors";
import { readAppliedManifest } from "#utils/applied-manifest";
import { attributeFiles } from "#utils/attribution";

const blame = new Command({
  name: "blame",
  description: "Show which powerup wrote a file",
  flags: [],
  subcommands: [],
  action: async ({ subcommands, context }) => {
    const filePath = subcommands?.[0];
    if (!is.defined(filePath)) throw diagnose_errors.missing_file();
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const manifest = await readAppliedManifest(root);
    const { attributed } = attributeFiles(manifest, [filePath!]);
    const entries = attributed.get(filePath!);
    if (entries === undefined) {
      cli.print(`${filePath}: not written by any powerup.\n`);
      return;
    }
    for (const entry of entries) {
      const vars = Object.entries(entry.variables)
        .map(([k, v]) => `${k}=${v}`).join(" ");
      cli.print(`${filePath!}\n  ← ${entry.powerup}@${entry.version}`);
      cli.print(` (${entry.location}, applied ${entry.appliedAt.slice(0, 10)})\n`);
      if (vars.length > 0) cli.print(`  variables: ${vars}\n`);
    }
  },
});

export default blame;
```

Create `packages/cli/src/commands/blame.ts` (same re-export pattern as diagnose.ts). Register `blame` in `packages/cli/src/commands/index.ts` (alphabetical, before `create`).

- [ ] **Step 4: Run spec → PASS; full suite → 0 failures; lint clean.**

- [ ] **Commit：**`git add packages/cli && git commit -m "feat: add pup blame command"`

---

### Task 6: Docs

- [ ] **Step 1:** `packages/cli/README.md` command table additions + Concepts bullet:

```markdown
| `diagnose -- <cmd>` | Run a command and attribute failures to powerups |
| `blame <file>`      | Show which powerup wrote a file                |

- **Attribution** — `pup diagnose -- npm run dev` maps error output through
  the applied manifest to the powerups that wrote the failing files, exits
  with the wrapped command's code. `pup blame <file>` answers "who wrote
  this?". Files no powerup wrote are reported as unattributed.
```

- [ ] **Step 2: Commit** `git commit -am "docs: document diagnose and blame"`

---

## Self-Review Notes (author)

- **Spec coverage:** wrap-command diagnose with streamed output + attribution + exit passthrough ✓ (Task 4); no-command mode ✓ (recent-applying listing; full interactive picker deferred — flagged); `pup blame` ✓ (Task 5); unattributed honesty ✓ (Tasks 1/2/4).
- **Type consistency:** `AttributionResult`/`buildAttributionReport` identical across Tasks 1/4/5; `extractErrorPaths` signature `(output, projectRoot)` consistent in Tasks 2/4.
- **Executor risks:** (1) `io.run` error shape for non-zero exits varies by version — the code defensively reads `.exitCode`/`.message`; if stderr isn't in the message, extend `io.run` call to capture stderr via a spawn fallback and note it in the commit; (2) `process.exitCode` assertion in tests — reset after each case as shown.
