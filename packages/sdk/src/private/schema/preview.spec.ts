import test from "@rcompat/test";
import { readFile } from "node:fs/promises";
import { previewSchema, previewJsonSchema } from "#schema/preview";

test.group("preview schema acceptance", () => {
  test.case("parses an empty preview.json", assert => {
    const result = previewSchema.parse({});
    assert(result).equals({});
  });

  test.case("parses variables only", assert => {
    const result = previewSchema.parse({ variables: { componentName: "Button" } });
    assert(result.variables).equals({ componentName: "Button" });
  });

  test.case("parses all fields", assert => {
    const result = previewSchema.parse({
      variables: { theme: "dark" },
      exec: "bun run dev",
      outputDir: ".preview",
      watch: true,
    });
    assert(result.variables).equals({ theme: "dark" });
    assert(result.exec).equals("bun run dev");
    assert(result.outputDir).equals(".preview");
    assert(result.watch).true();
  });
});

test.group("preview schema rejections", () => {
  test.case("rejects unknown keys", async assert => {
    let threw = false;
    try {
      previewSchema.parse({ variable: "typo" });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("rejects a non-string exec", async assert => {
    let threw = false;
    try {
      previewSchema.parse({ exec: 42 });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });
});

test.case("committed preview.schema.json is up to date", async assert => {
  const committed = await readFile(
    new URL("../../../preview.schema.json", import.meta.url),
    "utf8",
  );
  assert(`${JSON.stringify(previewJsonSchema(), null, 2)}\n`).equals(committed);
});