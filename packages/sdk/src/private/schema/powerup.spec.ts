import test from "@rcompat/test";
import { powerupPropertySchema } from "#schema/powerup";

test.case("accepts a valid powerup property with instructions", assert => {
  const result = powerupPropertySchema.parse({
    instructions: "index.ts",
  });

  assert(result.instructions).equals("index.ts");
});

test.case("accepts a powerup property with compatibility", assert => {
  const result = powerupPropertySchema.parse({
    instructions: "index.ts",
    compatibility: { version: "1.0.0" },
  });

  assert(result.instructions).equals("index.ts");
  assert(result.compatibility).defined();
});

test.case("rejects a powerup property missing instructions", assert => {
  let threw = false;
  try {
    powerupPropertySchema.parse({ compatibility: {} });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("rejects a string powerup property (old format)", assert => {
  let threw = false;
  try {
    powerupPropertySchema.parse("./instructions.json");
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("rejects a non-string instructions field", assert => {
  let threw = false;
  try {
    powerupPropertySchema.parse({ instructions: 123 });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("rejects a non-object powerup property", assert => {
  let threw = false;
  try {
    powerupPropertySchema.parse(null);
  } catch {
    threw = true;
  }
  assert(threw).true();
});