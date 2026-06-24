import test from "@rcompat/test";
import {parseFlags} from "./parseFlags.ts";

test.case("parseFlags: empty", assert => {
  const flags = parseFlags([], []);

  assert(flags.values).equals({});
  assert(flags.positional).equals([]);
});