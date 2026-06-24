import test from "@rcompat/test";
import {parseFlags} from "./parseFlags.ts";

test.case("debug: long boolean flag", assert => {
  const flags = parseFlags(["--verbose"], [
    { long: "--verbose", value: false },
  ]);
  console.log("values:", JSON.stringify(flags.values));
  assert(flags.values).equals({ verbose: true });
});

test.case("debug: long boolean not set", assert => {
  const flags = parseFlags([], [
    { long: "--verbose", value: false },
  ]);
  console.log("values:", JSON.stringify(flags.values));
  assert(flags.values).equals({ verbose: undefined });
});

test.case("debug: short boolean", assert => {
  const flags = parseFlags(["-v"], [
    { short: "-v", long: "--verbose", value: false },
  ]);
  console.log("values:", JSON.stringify(flags.values));
  assert(flags.values).equals({ verbose: true });
});

test.case("debug: array space repeated", assert => {
  const flags = parseFlags(["--tag", "foo", "--tag", "bar"], [
    { long: "--tag", value: true, array: true },
  ]);
  console.log("values:", JSON.stringify(flags.values));
  assert(flags.values).equals({ tag: ["foo", "bar"] });
});

test.case("debug: array single value", assert => {
  const flags = parseFlags(["--tag=foo"], [
    { long: "--tag", value: true, array: true },
  ]);
  console.log("values:", JSON.stringify(flags.values));
  assert(flags.values).equals({ tag: ["foo"] });
});

test.case("debug: array not provided", assert => {
  const flags = parseFlags([], [
    { long: "--tag", value: true, array: true },
  ]);
  console.log("values:", JSON.stringify(flags.values));
  assert(flags.values).equals({ tag: [] });
});

test.case("debug: default scalar", assert => {
  const flags = parseFlags([], [
    { long: "--name", value: true, default: "default-name" },
  ]);
  console.log("values:", JSON.stringify(flags.values));
  assert(flags.values).equals({ name: "default-name" });
});

test.case("debug: provided overrides default", assert => {
  const flags = parseFlags(["--name=override"], [
    { long: "--name", value: true, default: "default-name" },
  ]);
  console.log("values:", JSON.stringify(flags.values));
  assert(flags.values).equals({ name: "override" });
});

test.case("debug: missing required", assert => {
  let threw = false;
  try {
    parseFlags([], [{ long: "--name", value: true, required: true }]);
  } catch {
    threw = true;
  }
  console.log("threw:", threw);
  assert(threw).true();
});

test.case("debug: provided required", assert => {
  const flags = parseFlags(["--name=Alice"], [
    { long: "--name", value: true, required: true },
  ]);
  console.log("values:", JSON.stringify(flags.values));
  assert(flags.values).equals({ name: "Alice" });
});
