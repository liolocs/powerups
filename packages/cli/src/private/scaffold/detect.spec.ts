import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { detectHarnesses, VALID_HARNESSES } from "#scaffold/detect";
import { CodeError } from "@rcompat/error";
import { InitErrorCode } from "#errors/initErrors";
import { HARNESS_FINGERPRINTS } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

test.case("--harness override returns single-element array", async assert => {
  const result = await detectHarnesses("codex");
  assert(result).equals(["codex"]);
});

test.case("--harness override works with each valid harness", async assert => {
  for (const harness of VALID_HARNESSES) {
    const result = await detectHarnesses(harness);
    assert(result).equals([harness]);
  }
});

test.case("invalid --harness throws invalid_harness", async assert => {
  let threw;
  try {
    await detectHarnesses("foo");
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(InitErrorCode.invalid_harness);
});

test.group("comma-separated --harness", () => {
  test.case("parses two harnesses", async assert => {
    const result = await detectHarnesses("claude,pi");
    assert(result).equals(["claude", "pi"]);
  });

  test.case("trims whitespace around tokens", async assert => {
    const result = await detectHarnesses(" claude , pi ");
    assert(result).equals(["claude", "pi"]);
  });

  test.case("dedupes repeated harnesses", async assert => {
    const result = await detectHarnesses("claude,claude");
    assert(result).equals(["claude"]);
  });

  test.case("throws invalid_harness naming the bad token", async assert => {
    let threw;
    try {
      await detectHarnesses("claude,bogus");
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.invalid_harness);
  });

  test.case("empty string falls through to auto-detect", async assert => {
    await testRoot.remove();
    await fs.create(testRoot);
    await fs.create(testRoot.append("/.claude"));

    const result = await detectHarnesses("", { baseDir: testRoot.path });
    assert(result).equals(["claude"]);

    await testRoot.remove();
  });
});

test.case("returns all detected harnesses when multiple found", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.claude"));
  await fs.create(testRoot.append("/.pi/agent"));

  const result = await detectHarnesses(undefined, { baseDir: testRoot.path });
  assert(result.length).equals(2);
  assert(result.includes("claude")).true();
  assert(result.includes("pi")).true();

  await testRoot.remove();
});

test.case("detects single harness from fingerprints", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.claude"));

  const result = await detectHarnesses(undefined, { baseDir: testRoot.path });
  assert(result).equals(["claude"]);

  await testRoot.remove();
});

test.case("detects opencode", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.opencode}`));

  const result = await detectHarnesses(undefined, { baseDir: testRoot.path });
  assert(result).equals(["opencode"]);

  await testRoot.remove();
});

test.case("detects codex from .codex fingerprint", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.codex"));

  const result = await detectHarnesses(undefined, { baseDir: testRoot.path });
  assert(result).equals(["codex"]);

  await testRoot.remove();
});

test.case("detects all four harnesses when all fingerprints present", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.claude}`));
  await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.pi}`));
  await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.opencode}`));
  await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.codex}`));

  const result = await detectHarnesses(undefined, { baseDir: testRoot.path });
  assert(result.length).equals(4);
  assert(result.includes("claude")).true();
  assert(result.includes("pi")).true();
  assert(result.includes("opencode")).true();
  assert(result.includes("codex")).true();

  await testRoot.remove();
});

test.group("detect errors", () => {
  test.case("throws no_harness_detected when none found", async assert => {
    await testRoot.remove();
    await fs.create(testRoot);

    let threw;
    try {
      await detectHarnesses(undefined, { baseDir: testRoot.path });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.no_harness_detected);

    await testRoot.remove();
  });

  test.case("throws invalid_harness for an invalid --harness value", async assert => {
    let threw;
    try {
      await detectHarnesses("foo");
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.invalid_harness);
  });
});