import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { detectHarnesses, VALID_HARNESSES } from "#scaffold/detect";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

test.case("detects claude from CLAUDE.md", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await testRoot.append("/CLAUDE.md").write("# Test");

  const result = await detectHarnesses(testRoot, [], { skipGlobal: true });
  assert(result).equals(["claude"]);

  await testRoot.remove();
});

test.case("detects opencode from .opencode/ dir", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.opencode"));

  const result = await detectHarnesses(testRoot, [], { skipGlobal: true });
  assert(result).equals(["opencode"]);

  await testRoot.remove();
});

test.case("detects pi from .pi/ dir", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.pi"));

  const result = await detectHarnesses(testRoot, [], { skipGlobal: true });
  assert(result).equals(["pi"]);

  await testRoot.remove();
});

test.case("detects multiple harnesses", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.claude"));
  await fs.create(testRoot.append("/.pi"));

  const result = await detectHarnesses(testRoot, [], { skipGlobal: true });
  assert(result.includes("claude")).equals(true);
  assert(result.includes("pi")).equals(true);

  await testRoot.remove();
});

test.case("returns empty when nothing detected", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  const result = await detectHarnesses(testRoot, [], { skipGlobal: true });
  assert(result.length).equals(0);

  await testRoot.remove();
});

test.case("--harness flag overrides detection", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  const result = await detectHarnesses(testRoot, ["codex"]);
  assert(result).equals(["codex"]);

  await testRoot.remove();
});

test.case("invalid --harness value throws", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  let threw = false;
  try {
    await detectHarnesses(testRoot, ["foo"]);
  } catch {
    threw = true;
  }
  assert(threw).equals(true);

  await testRoot.remove();
});