import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { detectHarness, VALID_HARNESSES } from "#scaffold/detect";
import { CodeError } from "@rcompat/error";
import { InitErrorCode } from "#errors/initErrors";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

test.case("should detect claude from CLAUDE.md", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await testRoot.append("/CLAUDE.md").write("# Test");

  const result = await detectHarness(testRoot, undefined, { skipGlobal: true });
  assert(result).equals("claude");

  await testRoot.remove();
});

test.case("should detect claude from .claude/ dir", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.claude"));

  const result = await detectHarness(testRoot, undefined, { skipGlobal: true });
  assert(result).equals("claude");

  await testRoot.remove();
});

test.case("should detect opencode from .opencode/ dir", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.opencode"));

  const result = await detectHarness(testRoot, undefined, { skipGlobal: true });
  assert(result).equals("opencode");

  await testRoot.remove();
});

test.case("should detect pi from .pi/ dir", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.pi"));

  const result = await detectHarness(testRoot, undefined, { skipGlobal: true });
  assert(result).equals("pi");

  await testRoot.remove();
});

test.case("should count CLAUDE.md and .claude/ as one harness (claude)", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await testRoot.append("/CLAUDE.md").write("# Test");
  await fs.create(testRoot.append("/.claude"));

  const result = await detectHarness(testRoot, undefined, { skipGlobal: true });
  assert(result).equals("claude");

  await testRoot.remove();
});

test.case("should override detection with --harness flag", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  const result = await detectHarness(testRoot, "codex");
  assert(result).equals("codex");

  await testRoot.remove();
});

test.case("should work with --harness even when multiple detected", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.claude"));
  await fs.create(testRoot.append("/.pi"));

  const result = await detectHarness(testRoot, "pi");
  assert(result).equals("pi");

  await testRoot.remove();
});

test.group("detect errors", () => {
  test.case("should fail with multiple_harnesses_detected when several harnesses found locally", async assert => {
    await testRoot.remove();
    await fs.create(testRoot);
    await fs.create(testRoot.append("/.claude"));
    await fs.create(testRoot.append("/.pi"));

    let threw;
    try {
      await detectHarness(testRoot, undefined, { skipGlobal: true });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.multiple_harnesses_detected);

    await testRoot.remove();
  });

  test.case("should fail with no_harness_detected when none found", async assert => {
    await testRoot.remove();
    await fs.create(testRoot);

    let threw;
    try {
      await detectHarness(testRoot, undefined, { skipGlobal: true });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.no_harness_detected);

    await testRoot.remove();
  });

  test.case("should fail with invalid_harness for an invalid --harness value", async assert => {
    await testRoot.remove();
    await fs.create(testRoot);

    let threw;
    try {
      await detectHarness(testRoot, "foo");
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.invalid_harness);

    await testRoot.remove();
  });
});