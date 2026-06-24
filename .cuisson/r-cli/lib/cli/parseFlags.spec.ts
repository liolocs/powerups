import test from "@rcompat/test";
import {parseFlags} from "./parseFlags.ts";

test.case("parseFlags: empty", assert => {
  const flags = parseFlags([], []);

  assert(flags.values).equals({});
  assert(flags.positional).equals([]);
});

// ── Long flags with values ──────────────────────────────

test.case("parseFlags: long flag with = syntax", assert => {
  const flags = parseFlags(["--name=Alice"], [
    { long: "--name", value: true },
  ]);

  assert(flags.values).equals({ name: "Alice" });
  assert(flags.positional).equals([]);
});

test.case("parseFlags: long flag with space-separated value", assert => {
  const flags = parseFlags(["--name", "Alice"], [
    { long: "--name", value: true },
  ]);

  assert(flags.values).equals({ name: "Alice" });
  assert(flags.positional).equals([]);
});

test.case("parseFlags: multiple long flags with values", assert => {
  const flags = parseFlags(["--name=Alice", "--age=30"], [
    { long: "--name", value: true },
    { long: "--age", value: true },
  ]);

  assert(flags.values).equals({ name: "Alice", age: "30" });
  assert(flags.positional).equals([]);
});

// ── Boolean flags (no value) ────────────────────────────

test.case("parseFlags: long boolean flag", assert => {
  const flags = parseFlags(["--verbose"], [
    { long: "--verbose", value: false },
  ]);

  assert(flags.values).equals({ verbose: true });
  assert(flags.positional).equals([]);
});

test.case("parseFlags: long boolean flag not set", assert => {
  const flags = parseFlags([], [
    { long: "--verbose", value: false },
  ]);

  assert(flags.values).equals({ verbose: undefined });
});

test.case("parseFlags: multiple boolean flags", assert => {
  const flags = parseFlags(["--verbose", "--debug"], [
    { long: "--verbose", value: false },
    { long: "--debug", value: false },
  ]);

  assert(flags.values).equals({ verbose: true, debug: true });
});

// ── Short flags ─────────────────────────────────────────

test.case("parseFlags: short flag with value", assert => {
  const flags = parseFlags(["-n", "Alice"], [
    { short: "-n", long: "--name", value: true },
  ]);

  assert(flags.values).equals({ name: "Alice" });
});

test.case("parseFlags: short boolean flag", assert => {
  const flags = parseFlags(["-v"], [
    { short: "-v", long: "--verbose", value: false },
  ]);

  assert(flags.values).equals({ verbose: true });
});

test.case("parseFlags: short flag matching long only", assert => {
  const flags = parseFlags(["-v"], [
    { long: "--verbose", value: false },
  ]);

  assert(flags.values).equals({ verbose: true });
});

// ── Array flags ─────────────────────────────────────────

test.case("parseFlags: array flag with = syntax repeated", assert => {
  const flags = parseFlags(["--tag=foo", "--tag=bar"], [
    { long: "--tag", value: true, array: true },
  ]);

  assert(flags.values).equals({ tag: ["foo", "bar"] });
});

test.case("parseFlags: array flag with space-separated repeated", assert => {
  const flags = parseFlags(["--tag", "foo", "--tag", "bar"], [
    { long: "--tag", value: true, array: true },
  ]);

  assert(flags.values).equals({ tag: ["foo", "bar"] });
});

test.case("parseFlags: array flag single value", assert => {
  const flags = parseFlags(["--tag=foo"], [
    { long: "--tag", value: true, array: true },
  ]);

  assert(flags.values).equals({ tag: ["foo"] });
});

test.case("parseFlags: array flag not provided", assert => {
  const flags = parseFlags([], [
    { long: "--tag", value: true, array: true },
  ]);

  assert(flags.values).equals({ tag: [] });
});

// ── Default values ──────────────────────────────────────

test.case("parseFlags: default scalar value", assert => {
  const flags = parseFlags([], [
    { long: "--name", value: true, default: "default-name" },
  ]);

  assert(flags.values).equals({ name: "default-name" });
});

test.case("parseFlags: default array value is deep-copied", assert => {
  const defaults = ["a", "b"];
  const flags = parseFlags([], [
    { long: "--tag", value: true, array: true, default: defaults },
  ]);

  assert(flags.values).equals({ tag: ["a", "b"] });
  // Mutating the result should not affect the original default
  (flags.values.tag as string[]).push("c");
  assert(defaults).equals(["a", "b"]);
});

test.case("parseFlags: provided value overrides default", assert => {
  const flags = parseFlags(["--name=override"], [
    { long: "--name", value: true, default: "default-name" },
  ]);

  assert(flags.values).equals({ name: "override" });
});

test.case("parseFlags: default undefined for non-value flag", assert => {
  const flags = parseFlags([], [
    { long: "--verbose", value: false },
  ]);

  assert(flags.values).equals({ verbose: undefined });
});

// ── Positional arguments ────────────────────────────────

test.case("parseFlags: positional arguments", assert => {
  const flags = parseFlags(["cmd", "arg1", "arg2"], [
    { long: "--verbose", value: false },
  ]);

  assert(flags.values).equals({ verbose: undefined });
  assert(flags.positional).equals(["cmd", "arg1", "arg2"]);
});

test.case("parseFlags: positional between flags", assert => {
  const flags = parseFlags(["--verbose", "cmd", "arg1"], [
    { long: "--verbose", value: false },
  ]);

  assert(flags.values).equals({ verbose: true });
  assert(flags.positional).equals(["cmd", "arg1"]);
});

// ── Unknown flags as positional ─────────────────────────

test.case("parseFlags: unknown long flag stored as positional", assert => {
  const flags = parseFlags(["--unknown=value"], [
    { long: "--known", value: true },
  ]);

  assert(flags.values).equals({});
  assert(flags.positional).equals(["--unknown=value"]);
});

test.case("parseFlags: unknown short flag stored as positional", assert => {
  const flags = parseFlags(["-x"], [
    { short: "-k", long: "--known", value: true },
  ]);

  assert(flags.values).equals({});
  assert(flags.positional).equals(["-x"]);
});

// ── Required flag validation ────────────────────────────

test.case("parseFlags: missing required flag throws", assert => {
  let threw = false;
  try {
    parseFlags([], [
      { long: "--name", value: true, required: true },
    ]);
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("parseFlags: provided required flag passes", assert => {
  const flags = parseFlags(["--name=Alice"], [
    { long: "--name", value: true, required: true },
  ]);

  assert(flags.values).equals({ name: "Alice" });
});

test.case("parseFlags: boolean required flag", assert => {
  const flags = parseFlags(["--verbose"], [
    { long: "--verbose", value: false, required: true },
  ]);

  assert(flags.values).equals({ verbose: true });
});

test.case("parseFlags: missing boolean required flag throws", assert => {
  let threw = false;
  try {
    parseFlags([], [
      { long: "--verbose", value: false, required: true },
    ]);
  } catch {
    threw = true;
  }
  assert(threw).true();
});

// ── Mixed scenarios ─────────────────────────────────────

test.case("parseFlags: mixed short and long flags", assert => {
  const flags = parseFlags(["-v", "--name=Alice", "cmd"], [
    { short: "-v", long: "--verbose", value: false },
    { long: "--name", value: true },
  ]);

  assert(flags.values).equals({ verbose: true, name: "Alice" });
  assert(flags.positional).equals(["cmd"]);
});

test.case("parseFlags: array flag with default and override", assert => {
  const flags = parseFlags(["--tag=override"], [
    { long: "--tag", value: true, array: true, default: ["default"] },
  ]);

  assert(flags.values).equals({ tag: ["override"] });
});

test.case("parseFlags: array flag default with additional values", assert => {
  const flags = parseFlags(["--tag=extra"], [
    { long: "--tag", value: true, array: true, default: ["default"] },
  ]);

  // Provided value replaces the array (not appended to default)
  assert(flags.values).equals({ tag: ["extra"] });
});

test.case("parseFlags: value flag next to another flag", assert => {
  const flags = parseFlags(["--name", "--verbose"], [
    { long: "--name", value: true },
    { long: "--verbose", value: false },
  ]);

  // --verbose starts with "--" so it's not consumed as value for --name
  assert(flags.values).equals({ name: undefined, verbose: true });
});