import test from "@rcompat/test";
import {
  modificationSchema,
  modificationArraySchema,
} from "#schemas/modification";

test.case("parses a where string entry (top)", async assert => {
  const result = modificationSchema.parse({
    where: "top",
    content: "hello",
  });

  assert(result.where).equals("top");
  assert(result.content).equals("hello");
});

test.case("parses a where string entry (bottom)", async assert => {
  const result = modificationSchema.parse({
    where: "bottom",
    content: "world",
  });

  assert(result.where).equals("bottom");
  assert(result.content).equals("world");
});

test.case("parses a where string entry (exact replace)", async assert => {
  const result = modificationSchema.parse({
    where: "export const x = 1;",
    content: "export const x = 2;",
  });

  assert(result.where).equals("export const x = 1;");
  assert(result.content).equals("export const x = 2;");
});

test.case("parses a where after entry", async assert => {
  const result = modificationSchema.parse({
    where: { after: "// Register controllers" },
    content: "app.register(UserController);",
  });

  assert(typeof result.where === "object");
  assert((result.where as { after: string }).after).equals("// Register controllers");
});

test.case("parses a where before entry", async assert => {
  const result = modificationSchema.parse({
    where: { before: "// End of file" },
    content: "export default {}",
  });

  assert(typeof result.where === "object");
  assert((result.where as { before: string }).before).equals("// End of file");
});

test.case("parses an array of modifications via modificationArraySchema", async assert => {
  const result = modificationArraySchema.parse([
    { where: "top", content: "import { X } from \"./x\";" },
    { where: { after: "// Register" }, content: "app.register(X);" },
    { where: "export const y = 0;", content: "export const y = 1;" },
  ]);

  assert(result.length).equals(3);
  assert(result[0].where).equals("top");
  assert((result[1].where as { after: string }).after).equals("// Register");
  assert(result[2].content).equals("export const y = 1;");
});

test.case("rejects an entry missing content", async assert => {
  let threw = false;
  try {
    modificationSchema.parse({ where: "top" });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("rejects an entry missing where", async assert => {
  let threw = false;
  try {
    modificationSchema.parse({ content: "hello" });
  } catch {
    threw = true;
  }
  assert(threw).true();
});