import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { detectHarness, VALID_HARNESSES } from "#scaffold/detect";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

test.case("detects claude from CLAUDE.md", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await testRoot.append("/CLAUDE.md").write("# Test");

  const result = await detectHarness(testRoot, undefined, { skipGlobal: true });
  assert(result).equals("claude");

  await testRoot.remove();
});

test.case("detects claude from .claude/ dir", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.claude"));

  const result = await detectHarness(testRoot, undefined, { skipGlobal: true });
  assert(result).equals("claude");

  await testRoot.remove();
});

test.case("detects opencode from .opencode/ dir", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.opencode"));

  const result = await detectHarness(testRoot, undefined, { skipGlobal: true });
  assert(result).equals("opencode");

  await testRoot.remove();
});

test.case("detects pi from .pi/ dir", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.pi"));

  const result = await detectHarness(testRoot, undefined, { skipGlobal: true });
  assert(result).equals("pi");

  await testRoot.remove();
});

test.case("CLAUDE.md and .claude/ count as one harness (claude)", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await testRoot.append("/CLAUDE.md").write("# Test");
  await fs.create(testRoot.append("/.claude"));

  const result = await detectHarness(testRoot, undefined, { skipGlobal: true });
  assert(result).equals("claude");

  await testRoot.remove();
});

test.case("multiple local harnesses → error", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.claude"));
  await fs.create(testRoot.append("/.pi"));

  let threw = false;
  try {
    await detectHarness(testRoot, undefined, { skipGlobal: true });
  } catch {
    threw = true;
  }
  assert(threw).equals(true);

  await testRoot.remove();
});

test.case("no harness detected → error", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  let threw = false;
  try {
    await detectHarness(testRoot, undefined, { skipGlobal: true });
  } catch {
    threw = true;
  }
  assert(threw).equals(true);

  await testRoot.remove();
});

test.case("--harness flag overrides detection", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  const result = await detectHarness(testRoot, "codex");
  assert(result).equals("codex");

  await testRoot.remove();
});

test.case("--harness works even when multiple detected", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.claude"));
  await fs.create(testRoot.append("/.pi"));

  const result = await detectHarness(testRoot, "pi");
  assert(result).equals("pi");

  await testRoot.remove();
});

test.case("invalid --harness value throws", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  let threw = false;
  try {
    await detectHarness(testRoot, "foo");
  } catch {
    threw = true;
  }
  assert(threw).equals(true);

  await testRoot.remove();
});