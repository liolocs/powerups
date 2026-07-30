# Step 2 — Powerup Depends + Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Powerup packs can declare `depends` (pack-to-pack, auto-applied at `use` time) and `compatibility` (semver ranges against project packages, gated at `use` time), plus `pup use <name>@<range>` version selection.

**Architecture:** Declare `depends`/`compatibility` in the pack's `package.json` under the existing `powerups` property (instructions.json untouched). New pure-ish utilities (`name-range`, `compatibility`, `dependency-plan`) are exhaustively unit-tested; integration in `use` resolves the plan and applies unsatisfied dependencies *before* the requested powerup, in topological order, by recursively invoking `use.run`.

**Tech Stack:** TypeScript, pema, `semver` (new dependency), @rcompat/test + proby.

**Spec:** `docs/superpowers/specs/2026-07-30-powerups-depends-diagnose-fix-design.md` → Subsystem 2.
**Depends on:** Step 1 (manifest, `recordApplication` with `dependsOn` support — already merged).

**Scope note (deliberate deviation from spec):** The parallel version-aware store (`<name>/<version>/` directories) is **deferred** to a future Step 5. The npm store holds one version per pack; `pup use <name>@<range>` with an unsatisfying installed version triggers a re-install at the requested range with a warning (npm packs) or a hard error (internal/git packs). This is sufficient end-to-end; parallel coexisting versions are an optimization for conflicting multi-project machines.

**Conventions (from Step 1, unchanged):**
- Errors: `error.coded({...})` + `error.template`; export `XErrorCode` map.
- Tests: `import test from "@rcompat/test"`, `test.case(...)`; run one spec: `npx proby packages/cli/src/private/utils/dependency-plan.spec.ts` from repo root.
- Alias `#*` → `packages/cli/src/private/*.ts`.
- `use.spec.ts` helpers: `reset()`, `gitInit()`, `gitCommit()`, `createPowerup(name, steps, opts)` (creates into pack `test-pkg`, `--pack` flag changes pack), `mainFolder`, `internalFolder`, `multiUseFolder` (= `internalFolder/test-pkg/multi-use`), `tempGlobalRoot`, `captureStdout`.

---

### Task 1: Add `semver` dependency

**Files:** Modify `packages/cli/package.json`

- [ ] **Step 1: Install**

```bash
cd packages/cli && pnpm add semver && pnpm add -D @types/semver
```

- [ ] **Step 2: Verify importable**

Add a temporary probe — run an existing spec to confirm resolution still works:
`npx proby packages/cli/src/private/schemas/applied.spec.ts` → PASS.

- [ ] **Step 3: Commit**

`git add packages/cli/package.json pnpm-lock.yaml && git commit -m "chore: add semver dependency"`

---

### Task 2: Extend pack schema with `depends` + `compatibility`

**Files:**
- Modify `packages/cli/src/private/schemas/package.ts`
- Create `packages/cli/src/private/schemas/package.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "@rcompat/test";
import { packageJsonSchema } from "#schemas/package";

const base = {
  name: "@powerups/shadcn",
  version: "1.0.0",
  description: "test",
  keywords: ["powerups-package"],
  powerups: { active: { "multi-use": { shadcn: "./multi-use/shadcn/instructions.json" } } },
};

test.case("accepts depends and compatibility", assert => {
  const parsed = packageJsonSchema.parse({
    ...base,
    powerups: {
      ...base.powerups,
      depends: { "@powerups/base-init": "^1.0.0" },
      compatibility: { primate: "^0.31.0" },
    },
  });
  assert(parsed.powerups.depends!["@powerups/base-init"]).equals("^1.0.0");
  assert(parsed.powerups.compatibility!.primate).equals("^0.31.0");
});

test.case("depends/compatibility are optional", assert => {
  const parsed = packageJsonSchema.parse(base);
  assert(parsed.powerups.depends === undefined).true();
  assert(parsed.powerups.compatibility === undefined).true();
});
```

- [ ] **Step 2: Run, expect FAIL** — `#schemas/package` spec fails on unknown/missing fields.

- [ ] **Step 3: Implement** — in `packages/cli/src/private/schemas/package.ts`, extend `powerupPropertySchema`:

```ts
export const powerupPropertySchema = p({
  active: p({
    [MULTI_USE_FOLDER]: p.record(p.string, p.string).optional(),
    [SINGLE_USE_FOLDER]: p.record(p.string, p.string).optional(),
  }),
  /** Pack-to-pack dependencies: pack name → semver range. */
  depends: p.record(p.string, p.string).optional(),
  /** Project packages this pack is valid for: package name → semver range. */
  compatibility: p.record(p.string, p.string).optional(),
});
```

- [ ] **Step 4: Run, expect PASS** (2/2). Also run `npx proby packages/cli/src/private/utils/resolve-powerup.spec.ts` → still PASS (backward compatible).

- [ ] **Step 5: Commit**

`git add packages/cli/src/private/schemas/package.ts packages/cli/src/private/schemas/package.spec.ts && git commit -m "feat: add depends and compatibility to pack schema"`

---

### Task 3: `name-range` util (parse `name@range`, scoped-name safe)

**Files:**
- Create `packages/cli/src/private/utils/name-range.ts`
- Create `packages/cli/src/private/utils/name-range.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import test from "@rcompat/test";
import { parseNameRange } from "#utils/name-range";

test.case("plain name has no range", assert => {
  assert(parseNameRange("shadcn").range === undefined).true();
});

test.case("unscoped name@range", assert => {
  const r = parseNameRange("shadcn@^2");
  assert(r.name).equals("shadcn");
  assert(r.range).equals("^2");
});

test.case("scoped name without range", assert => {
  assert(parseNameRange("@powerups/shadcn").name).equals("@powerups/shadcn");
  assert(parseNameRange("@powerups/shadcn").range === undefined).true();
});

test.case("scoped name@range", assert => {
  const r = parseNameRange("@powerups/shadcn@^2.1.0");
  assert(r.name).equals("@powerups/shadcn");
  assert(r.range).equals("^2.1.0");
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** `packages/cli/src/private/utils/name-range.ts`:

```ts
/**
 * Split a `name@range` powerup specifier. Scoped names are safe: a leading
 * `@` is part of the scope, not a range separator.
 */
export function parseNameRange(input: string): { name: string; range?: string } {
  const at = input.lastIndexOf("@");
  if (at > 0) {
    return { name: input.slice(0, at), range: input.slice(at + 1) };
  }
  return { name: input };
}
```

- [ ] **Step 4: Run, PASS (4/4). Commit：**`git add -A && git commit -m "feat: add name@range parser"`

---

### Task 4: `compatibility` util

**Files:**
- Create `packages/cli/src/private/utils/compatibility.ts`
- Create `packages/cli/src/private/utils/compatibility.spec.ts`

Behavior: given a pack's `compatibility` map and the project root, resolve the project's actual version per package — `node_modules/<pkg>/package.json` version first, else `semver.coerce` of the declared range in the project's package.json. Violation when version unresolvable or range unsatisfied.

- [ ] **Step 1: Failing test** (uses tmpdir fixtures — create project package.json + node_modules entries on disk):

```ts
import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { checkCompatibility } from "#utils/compatibility";

async function fixture(pkgJson: object, nodeModules?: Record<string, string>): Promise<FileRef> {
  const root = fs.ref(path.join(tmpdir(), `compat-${randomUUID()}`));
  await fs.create(root);
  await root.append("/package.json").writeJSON(pkgJson as never);
  for (const [name, version] of Object.entries(nodeModules ?? {})) {
    await fs.create(root.append(`/node_modules/${name}`));
    await root.append(`/node_modules/${name}/package.json`).writeJSON({ name, version } as never);
  }
  return root;
}

test.case("satisfied via node_modules version", async assert => {
  const root = await fixture(
    { dependencies: { primate: "^0.31.0" } },
    { primate: "0.31.2" },
  );
  const v = await checkCompatibility({ root, compatibility: { primate: "^0.31.0" } });
  assert(v.length).equals(0);
  await root.remove();
});

test.case("violated via node_modules version", async assert => {
  const root = await fixture(
    { dependencies: { primate: "^0.31.0" } },
    { primate: "0.30.2" },
  );
  const v = await checkCompatibility({ root, compatibility: { primate: "^0.31.0" } });
  assert(v.length).equals(1);
  assert(v[0].pkg).equals("primate");
  assert(v[0].actual).equals("0.30.2");
  await root.remove();
});

test.case("falls back to declared range coercion", async assert => {
  const root = await fixture({ dependencies: { primate: "^0.31.1" } });
  const ok = await checkCompatibility({ root, compatibility: { primate: "^0.31.0" } });
  assert(ok.length).equals(0);
  await root.remove();
});

test.case("unknown project version is a violation", async assert => {
  const root = await fixture({});
  const v = await checkCompatibility({ root, compatibility: { primate: "^0.31.0" } });
  assert(v.length).equals(1);
  assert(v[0].actual === undefined).true();
  await root.remove();
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** `packages/cli/src/private/utils/compatibility.ts`:

```ts
import fs, { type FileRef } from "@rcompat/fs";
import semver from "semver";

export interface CompatibilityViolation {
  pkg: string;
  /** Declared range the pack requires. */
  range: string;
  /** Project's actual version, when resolvable. */
  actual?: string;
}

async function projectVersion(root: FileRef, pkg: string): Promise<string | undefined> {
  const installed = root.append(`/node_modules/${pkg}/package.json`);
  if (await fs.exists(installed)) {
    const json = await installed.json() as { version?: string };
    if (typeof json.version === "string") return json.version;
  }
  const manifest = root.append("/package.json");
  if (await fs.exists(manifest)) {
    const json = await manifest.json() as Record<string, Record<string, string> | undefined>;
    const declared = json.dependencies?.[pkg] ?? json.devDependencies?.[pkg]
      ?? json.peerDependencies?.[pkg];
    if (typeof declared === "string") {
      return semver.coerce(declared)?.version;
    }
  }
  return undefined;
}

/**
 * Check a pack's `compatibility` ranges against the project's actual package
 * versions. Returns every violation (empty when fully satisfied).
 */
export async function checkCompatibility({
  root,
  compatibility,
}: {
  root: FileRef;
  compatibility: Record<string, string>;
}): Promise<CompatibilityViolation[]> {
  const violations: CompatibilityViolation[] = [];
  for (const [pkg, range] of Object.entries(compatibility)) {
    const actual = await projectVersion(root, pkg);
    if (actual === undefined || !semver.satisfies(actual, range, { includePrerelease: true })) {
      violations.push({ pkg, range, actual });
    }
  }
  return violations;
}
```

- [ ] **Step 4: Run, PASS (4/4). Commit：**`git add -A && git commit -m "feat: add compatibility range checker"`

---

### Task 5: `dependsErrors` factory

**Files:** Create `packages/cli/src/private/errors/dependsErrors.ts`

- [ ] **Step 1: Implement** (pattern from `errors/createErrors.ts`):

```ts
import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const depends_errors = error.coded({
  dependency_cycle: (path: string) => {
    const errorText = `Dependency cycle detected:\n  ${path}\nRemove one of the depends entries to break the cycle.`;
    return t`${errorBGText}${errorText}`;
  },
  dependency_pack_not_found: (name: string) => {
    const errorText = `Dependency pack "${name}" is not installed in the local or global store. Run "${CLI_CMD} install npm:${name}" first.`;
    return t`${errorBGText}${errorText}`;
  },
  ambiguous_dep_powerup: (packName: string, count: number) => {
    const errorText = `Dependency pack "${packName}" defines ${count} powerups; auto-resolution requires exactly one powerup per pack.`;
    return t`${errorBGText}${errorText}`;
  },
  version_not_satisfied: (name: string, version: string, range: string, kind: string) => {
    const errorText =
      `${name}@${version} (installed in the ${kind} store) does not satisfy requested range "${range}".\n` +
      (kind === "npm"
        ? `Run "${CLI_CMD} install npm:${name}@${range}" to switch versions.`
        : `${kind} packs hold a single version — update the pack manually or use the npm store.`);
    return t`${errorBGText}${errorText}`;
  },
  compatibility_violations: (lines: string) => {
    const errorText = `Compatibility check failed:\n${lines}\nFix the project package versions, or run "${CLI_CMD} fix <name> start" to create a compatible powerup version.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type DependsErrorCode = keyof typeof depends_errors;
export const DependsErrorCode = Object.fromEntries(
  Object.keys(depends_errors).map(k => [k, k]),
) as { [K in DependsErrorCode]: K };
export default depends_errors;
```

- [ ] **Step 2: Commit**：`git add -A && git commit -m "feat: add depends error factory"`

---

### Task 6: `dependency-plan` util

**Files:**
- Create `packages/cli/src/private/utils/dependency-plan.ts`
- Create `packages/cli/src/private/utils/dependency-plan.spec.ts`

Exports: `readPackMeta`, `findPackByName`, `resolveDependencies`.

- [ ] **Step 1: Failing test** — fixture store on disk (tmpdir as a fake project root with `.powerups/internal/<pack>/...`), pre-seeded manifest via `recordApplication` for skip cases:

```ts
import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MAIN_FOLDER, INTERNAL_FOLDER, MULTI_USE_FOLDER, PACKAGE_FILE } from "#constants";
import { recordApplication } from "#utils/applied-manifest";
import { findPackByName, resolveDependencies } from "#utils/dependency-plan";

async function fixture(): Promise<FileRef> {
  const root = fs.ref(path.join(tmpdir(), `depplan-${randomUUID()}`));
  await fs.create(root.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}`));
  return root;
}

async function addPack(root: FileRef, name: string, version: string,
  powerups: Record<string, string>, depends?: Record<string, string>) {
  const dir = root.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${name}`);
  await fs.create(dir);
  await dir.append(`/${PACKAGE_FILE}`).writeJSON({
    name, version, description: "t", keywords: ["powerups-package"],
    powerups: {
      active: { [MULTI_USE_FOLDER]: powerups, "single-use": {} },
      ...(depends ? { depends } : {}),
    },
  } as never);
}

test.case("findPackByName locates an internal pack", async assert => {
  const root = await fixture();
  await addPack(root, "base", "1.0.0", { init: "./multi-use/init/instructions.json" });
  const found = await findPackByName(root, "base");
  assert(found !== null).true();
  assert(found!.version).equals("1.0.0");
  assert(found!.location).equals("local");
  await root.remove();
});

test.case("findPackByName returns null when missing", async assert => {
  const root = await fixture();
  assert((await findPackByName(root, "nope")) === null).true();
  await root.remove();
});

test.case("resolveDependencies returns deps in topological order", async assert => {
  const root = await fixture();
  await addPack(root, "base", "1.0.0", { init: "x" });
  await addPack(root, "mid", "1.0.0", { setup: "x" }, { base: "^1.0.0" });
  await addPack(root, "top", "1.0.0", { ui: "x" }, { mid: "^1.0.0" });
  const start = (await findPackByName(root, "top"))!;
  const plan = await resolveDependencies({ root, startPack: start });
  assert(plan.map(p => p.pack.packName).join(",")).equals("base,mid");
  await root.remove();
});

test.case("satisfied deps are skipped", async assert => {
  const root = await fixture();
  await addPack(root, "base", "1.0.0", { init: "x" });
  await addPack(root, "top", "1.0.0", { ui: "x" }, { base: "^1.0.0" });
  await recordApplication({
    root, powerup: "base", name: "init", version: "1.0.0", location: "local",
    variables: {}, changedFiles: [],
  });
  const start = (await findPackByName(root, "top"))!;
  const plan = await resolveDependencies({ root, startPack: start });
  assert(plan.length).equals(0);
  await root.remove();
});

test.case("unsatisfied applied version is re-planned", async assert => {
  const root = await fixture();
  await addPack(root, "base", "2.0.0", { init: "x" });
  await addPack(root, "top", "1.0.0", { ui: "x" }, { base: "^2.0.0" });
  await recordApplication({
    root, powerup: "base", name: "init", version: "1.0.0", location: "local",
    variables: {}, changedFiles: [],
  });
  const start = (await findPackByName(root, "top"))!;
  const plan = await resolveDependencies({ root, startPack: start });
  assert(plan.length).equals(1);
  await root.remove();
});

test.case("diamond deps apply once", async assert => {
  const root = await fixture();
  await addPack(root, "base", "1.0.0", { init: "x" });
  await addPack(root, "left", "1.0.0", { l: "x" }, { base: "^1.0.0" });
  await addPack(root, "right", "1.0.0", { r: "x" }, { base: "^1.0.0" });
  await addPack(root, "top", "1.0.0", { ui: "x" }, { left: "^1.0.0", right: "^1.0.0" });
  const start = (await findPackByName(root, "top"))!;
  const plan = await resolveDependencies({ root, startPack: start });
  assert(plan.filter(p => p.pack.packName === "base").length).equals(1);
  assert(plan.length).equals(3);
  await root.remove();
});

test.case("cycles throw dependency_cycle", async assert => {
  const root = await fixture();
  await addPack(root, "a", "1.0.0", { x: "x" }, { b: "^1.0.0" });
  await addPack(root, "b", "1.0.0", { y: "y" }, { a: "^1.0.0" });
  const start = (await findPackByName(root, "a"))!;
  try {
    await resolveDependencies({ root, startPack: start });
    assert(true).false();
  } catch (e) {
    assert((e as { code?: string }).code).equals("dependency_cycle");
  }
  await root.remove();
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** `packages/cli/src/private/utils/dependency-plan.ts`:

```ts
import fs, { type FileRef } from "@rcompat/fs";
import { homedir } from "node:os";
import path from "node:path";
import semver from "semver";
import { packageJsonSchema, type PackageJson } from "#schemas/package";
import { readAppliedManifest } from "#utils/applied-manifest";
import depends_errors from "#errors/dependsErrors";
import {
  CLI_NAME, GIT_STORE, INTERNAL_FOLDER, MAIN_FOLDER, MULTI_USE_FOLDER,
  NPM_STORE, PACKAGE_FILE, SINGLE_USE_FOLDER, type PowerUpType,
} from "#constants";

export interface PackMeta {
  packName: string;
  packDir: FileRef;
  pkgJson: PackageJson;
  version: string;
  /** Depends map: pack name → semver range (empty when undeclared). */
  depends: Record<string, string>;
  /** Compatibility map: project package → semver range (empty when undeclared). */
  compatibility: Record<string, string>;
}

export interface PackLookup extends PackMeta {
  location: "local" | "global";
}

export interface PlannedDependency {
  pack: PackLookup;
  /** The single powerup of the dependency pack to apply. */
  powerupName: string;
  powerupType: PowerUpType;
  /** The semver range that required this pack. */
  range: string;
}

/** Read a pack's package.json into normalized metadata. */
export async function readPackMeta(packDir: FileRef): Promise<PackMeta | null> {
  const pkgJsonRef = packDir.append(`/${PACKAGE_FILE}`);
  if (!(await fs.exists(pkgJsonRef))) return null;
  const pkgJson = packageJsonSchema.parse(await pkgJsonRef.json());
  const powerups = pkgJson[CLI_NAME] as { depends?: Record<string, string>; compatibility?: Record<string, string> };
  return {
    packName: pkgJson.name,
    packDir,
    pkgJson,
    version: pkgJson.version,
    depends: powerups.depends ?? {},
    compatibility: powerups.compatibility ?? {},
  };
}

/**
 * Find an installed pack by package name. Search order: project internal →
 * project npm → global internal → global npm. Returns null when not installed.
 */
export async function findPackByName(
  root: FileRef,
  name: string,
  homeDir?: string,
): Promise<PackLookup | null> {
  const home = homeDir ?? homedir();
  const candidates: { dir: FileRef; location: "local" | "global" }[] = [
    { dir: root.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${name}`), location: "local" },
    { dir: root.append(`/${MAIN_FOLDER}/${NPM_STORE}/node_modules/${name}`), location: "local" },
    { dir: fs.ref(path.join(home, MAIN_FOLDER, INTERNAL_FOLDER, name)), location: "global" },
    { dir: fs.ref(path.join(home, MAIN_FOLDER, NPM_STORE, "node_modules", name)), location: "global" },
  ];
  for (const candidate of candidates) {
    const meta = await readPackMeta(candidate.dir);
    if (meta !== null && meta.packName === name) {
      return { ...meta, location: candidate.location };
    }
  }
  return null;
}

/** Guess the store kind from a pack dir path (for version-switch messaging). */
export function guessStoreKind(packDir: FileRef): "npm" | "git" | "internal" {
  if (packDir.path.includes(`${NPM_STORE}/node_modules`)) return "npm";
  if (packDir.path.includes(`/${GIT_STORE}/`)) return "git";
  return "internal";
}

/** The single powerup of a pack (one-powerup-per-pack constraint). */
function singlePowerup(meta: PackMeta): { name: string; type: PowerUpType } {
  const active = meta.pkgJson[CLI_NAME].active;
  const multi = Object.keys(active[MULTI_USE_FOLDER] ?? {}).map(name => ({ name, type: "multi-use" as const }));
  const single = Object.keys(active[SINGLE_USE_FOLDER] ?? {}).map(name => ({ name, type: "single-use" as const }));
  const all = [...multi, ...single];
  if (all.length !== 1) {
    throw depends_errors.ambiguous_dep_powerup(meta.packName, all.length);
  }
  return all[0]!;
}

/**
 * Build the ordered list of dependency packs to apply before the start pack,
 * in topological order (deepest first). Deps already satisfied by the applied
 * manifest are skipped. Diamonds apply once; cycles throw dependency_cycle.
 */
export async function resolveDependencies({
  root,
  startPack,
  homeDir,
}: {
  root: FileRef;
  startPack: PackMeta;
  homeDir?: string;
}): Promise<PlannedDependency[]> {
  const manifest = await readAppliedManifest(root);
  const seen = new Set<string>();
  const plan: PlannedDependency[] = [];

  const visit = async (pack: PackMeta, chain: string[]): Promise<void> => {
    for (const [depName, range] of Object.entries(pack.depends)) {
      if (chain.includes(depName)) {
        throw depends_errors.dependency_cycle([...chain, depName].join(" → "));
      }
      if (seen.has(depName)) continue;

      const lookup = await findPackByName(root, depName, homeDir);
      if (lookup === null) {
        throw depends_errors.dependency_pack_not_found(depName);
      }

      const applied = manifest.applied.find(e => e.powerup === depName);
      const satisfied = applied !== undefined
        && semver.satisfies(applied.version, range, { includePrerelease: true });

      if (!satisfied) {
        await visit(lookup, [...chain, depName]);
        const powerup = singlePowerup(lookup);
        plan.push({ pack: lookup, powerupName: powerup.name, powerupType: powerup.type, range });
      }
      seen.add(depName);
    }
  };

  await visit(startPack, [startPack.packName]);
  return plan;
}
```

- [ ] **Step 4: Run, PASS (7/7). Commit：**`git add -A && git commit -m "feat: add dependency plan resolution"`

---

### Task 7: Integrate into `use`

**Files:**
- Modify `packages/cli/src/private/commands/use/index.ts`
- Modify `packages/cli/src/private/commands/use/use.spec.ts`

Behavior (inserted into `action`, after step 3's `resolvePowerUp`, before validation):
1. Parse `name@range` from the positional arg.
2. Read pack meta at `outputFolder.up(2)`. If `range` declared and pack version doesn't satisfy: npm → warn + re-install at range via `installNpmPackage`, re-read meta; git/internal → `version_not_satisfied`. On compatibility violations in meta → `compatibility_violations`.
3. Unless `--no-deps` in rawFlags: `resolveDependencies`, then for each planned dep call `use.run({ subcommands: [dep.powerupName], rawFlags, flags, context })` (variables pass through; deps' own resolution handles their chains).
4. Pass `dependsOn` (applied deps as `"name@range"`) into the existing `recordApplication` call.

- [ ] **Step 1: Failing tests** — append to `use.spec.ts`. Setup pattern:

```ts
async function createPowerupInPack(pack: string, name: string, steps: unknown[]) {
  await createCmd.run({
    subcommands: [name],
    flags: [
      { flag: "--pack", value: pack },
      { flag: "--type", value: "multi-use" },
      { flag: "--description", value: "test description" },
    ],
    context: { root: testRoot, globalRoot: tempGlobalRoot },
  });
  await internalFolder.append(`/${pack}/${MULTI_USE_FOLDER}/${name}/instructions.json`).writeJSON({
    name, description: "t", variables: { required: [] }, intent: [], steps,
  } as never);
}

async function setPackDepends(pack: string, depends: Record<string, string>,
  compatibility?: Record<string, string>) {
  const ref = internalFolder.append(`/${pack}/${PACKAGE_FILE}`);
  const json = await ref.json() as Record<string, unknown>;
  const powerups = json.powerups as Record<string, unknown>;
  powerups.depends = depends;
  if (compatibility) powerups.compatibility = compatibility;
  await ref.writeJSON(json as never);
}

test.case("use auto-applies unsatisfied depends first", async assert => {
  await reset();
  await createPowerupInPack("test-dep", "dep-init", [
    { type: "create", name: "dep.txt", template: "dep.njk", outputPath: ".test-dep/dep.txt" },
  ]);
  await internalFolder.append(`/test-dep/${MULTI_USE_FOLDER}/dep-init/dep.njk`).write("dep");
  await createPowerupInPack("test-pkg", "main-pow", [
    { type: "create", name: "main.txt", template: "main.njk", outputPath: ".test-main/main.txt" },
  ]);
  await multiUseFolder.append("/main-pow/main.njk").write("main");
  await setPackDepends("test-pkg", { "test-dep": "^1.0.0" });

  await use.run({
    subcommands: ["main-pow"],
    flags: [],
    context: { root: testRoot, globalRoot: tempGlobalRoot },
  });

  assert(await fs.exists(testRoot.append("/.test-dep/dep.txt"))).true();
  assert(await fs.exists(testRoot.append("/.test-main/main.txt"))).true();
  const manifest = appliedManifestSchema.parse(await mainFolder.append(`/${APPLIED_FILE}`).json());
  const main = manifest.applied.find(e => e.name === "main-pow")!;
  assert(main.dependsOn!.includes("test-dep@^1.0.0")).true();
});

test.case("satisfied depends are skipped", async assert => {
  await reset();
  await createPowerupInPack("test-dep", "dep-init", [
    { type: "create", name: "dep.txt", template: "dep.njk", outputPath: ".test-dep2/dep.txt" },
  ]);
  await internalFolder.append(`/test-dep/${MULTI_USE_FOLDER}/dep-init/dep.njk`).write("dep");
  await createPowerupInPack("test-pkg", "main-pow", [
    { type: "create", name: "main.txt", template: "main.njk", outputPath: ".test-main2/main.txt" },
  ]);
  await multiUseFolder.append("/main-pow/main.njk").write("main");
  await setPackDepends("test-pkg", { "test-dep": "^1.0.0" });
  await recordApplication({
    root: testRoot, powerup: "test-dep", name: "dep-init", version: "1.0.0",
    location: "local", variables: {}, changedFiles: [],
  });

  await use.run({
    subcommands: ["main-pow"],
    flags: [],
    context: { root: testRoot, globalRoot: tempGlobalRoot },
  });

  assert(await fs.exists(testRoot.append("/.test-dep2/dep.txt"))).false();
});

test.case("--no-deps skips auto-resolution", async assert => { /* same setup as first case, plus rawFlags: [{flag:"--no-deps", value:""}] — assert dep file NOT created, main created, no dependsOn recorded */ });

test.case("compatibility violation throws", async assert => {
  await reset();
  await createPowerupInPack("test-pkg", "main-pow", [
    { type: "create", name: "m.txt", template: "m.njk", outputPath: ".test-c/m.txt" },
  ]);
  await multiUseFolder.append("/main-pow/m.njk").write("m");
  await setPackDepends("test-pkg", {}, { primate: "^0.31.0" });
  await testRoot.append("/package.json").writeJSON({ dependencies: { primate: "^0.30.0" } } as never);
  await fs.create(testRoot.append("/node_modules/primate"));
  await testRoot.append("/node_modules/primate/package.json").writeJSON({ version: "0.30.2" } as never);

  try {
    await use.run({
      subcommands: ["main-pow"], flags: [],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    });
    assert(true).false();
  } catch (e) {
    assert((e as { code?: string }).code).equals("compatibility_violations");
  }
});

test.case("use name@range errors for internal pack version mismatch", async assert => {
  // setup a pack at version 1.0.0; `use.run({ subcommands: ["main-pow@^2.0.0"], ... })`
  // expect code "version_not_satisfied"
});
```

Add imports to `use.spec.ts`: `import { recordApplication } from "#utils/applied-manifest";`.

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement in `use/index.ts`:**

**a)** New imports:

```ts
import semver from "semver";
import { parseNameRange } from "#utils/name-range";
import { checkCompatibility } from "#utils/compatibility";
import { readPackMeta, resolveDependencies, guessStoreKind } from "#utils/dependency-plan";
import { installNpmPackage } from "#utils/install-package";
import depends_errors from "#errors/dependsErrors";
```

**b)** Add `--no-deps` flag to the `flags` array:

```ts
{ name: "no-deps", long: "no-deps", description: "Skip depends auto-resolution" },
```

Add `"--no-deps"` to `EXCLUDE_FLAGS`.

**c)** After `const resolved = await resolvePowerUp(...)` (and before checkOutput), insert:

```ts
    // 3.5 Version range + compatibility + depends resolution
    const { name: powerupName, range } = parseNameRange(name);
    const packDir = outputFolder.up(2);
    let packMeta = await readPackMeta(packDir);
    if (packMeta === null) throw use_errors.invalid_composition([`pack missing package.json: ${packDir.path}`]);

    if (range !== undefined && !semver.satisfies(packMeta.version, range, { includePrerelease: true })) {
      const kind = guessStoreKind(packDir);
      if (kind === "npm") {
        cli.print(`Warning: ${packMeta.packName}@${packMeta.version} does not satisfy "${range}" — reinstalling at range\n`);
        await installNpmPackage(typeFolder.up(2).up(1), `${packMeta.packName}@${range}`);
        packMeta = (await readPackMeta(packDir))!;
      } else {
        throw depends_errors.version_not_satisfied(packMeta.packName, packMeta.version, range, kind);
      }
    }

    const violations = await checkCompatibility({ root, compatibility: packMeta.compatibility });
    if (violations.length > 0) {
      const lines = violations.map(v =>
        `  - ${v.pkg}: requires ${v.range}, project has ${v.actual ?? "unknown"}`).join("\n");
      throw depends_errors.compatibility_violations(lines);
    }

    const skipDeps = (rawFlags ?? []).some(f => f.flag === "--no-deps");
    let appliedDepends: string[] = [];
    if (!skipDeps) {
      const plan = await resolveDependencies({ root, startPack: packMeta });
      appliedDepends = plan.map(dep => `${dep.pack.packName}@${dep.range}`);
      for (const dep of plan) {
        await use.run({
          subcommands: [dep.powerupName],
          rawFlags: [...(rawFlags ?? []), { flag: "--no-deps", value: "" }],
          flags,
          context,
        });
      }
    }
```

Note: the recursive call passes `--no-deps` because `resolveDependencies` already flattened the full transitive chain — prevents double planning. The recursive `use.run` resolves the dep powerup by name via normal config lookup (the pack is installed, so resolution succeeds).

**d)** In the existing `recordApplication` call, add:

```ts
        dependsOn: appliedDepends.length > 0 ? appliedDepends : undefined,
```

Note: `outputFolder`/`typeFolder`/`resolved` were computed from the original `name`; use `powerupName` (range-stripped) for `resolvePowerUp` — change step 3 to `resolvePowerUp(root, powerupName, typeFlag)`. `packDir` npm re-install path: typeFolder is `packDir/<type>`; for npm store `typeFolder.up(2)` lands on the `npm` dir's parent (storeRoot-relative) — adjust: pass `packDir.up(2)` as storeRoot when kind is npm (packDir = `npm/node_modules/<name>` → up(2) = storeRoot). Implement exactly that.

- [ ] **Step 4: Run use.spec.ts → PASS. Run full suite `npx proby packages/cli` → 0 failures. Lint `cd packages/cli && npx eslint .` → no new errors.**

- [ ] **Step 5: Commit**

`git add packages/cli && git commit -m "feat: depends auto-resolution and compatibility gate in use"`

---

### Task 8: Docs

- [ ] **Step 1:** In `packages/cli/README.md`, add to the command table `pup use <name>@<range>` note and a Concepts bullet:

```markdown
- **Depends** — a pack's `package.json` may declare `powerups.depends`
  (pack → semver range). `pup use` auto-applies unsatisfied dependencies
  first, in order. `--no-deps` skips this.
- **Compatibility** — `powerups.compatibility` declares which project package
  versions a pack is valid for (e.g. `{ "primate": "^0.31.0" }`); `pup use`
  fails fast when the project doesn't match.
```

- [ ] **Step 2: Commit** `git commit -am "docs: document depends and compatibility"`

---

## Self-Review Notes (author)

- **Spec coverage:** depends declaration/auto-apply/cycles/diamonds/skip-satisfied/`--no-deps`/compat gate/`@range` — all tasked. Version-aware parallel store explicitly deferred (see scope note).
- **Type consistency:** `PackMeta`/`PackLookup`/`PlannedDependency` identical across Tasks 6–7; `dependsOn` matches Step 1 manifest schema (`string[]`, `"name@range"` format).
- **Executor risks:** (1) npm re-install storeRoot depth in Task 7c — verify `packDir.up(2)` against an npm-store fixture; (2) recursive `use.run` with `--no-deps` relies on `rawFlags` being passed through — confirmed against current `use` implementation.
