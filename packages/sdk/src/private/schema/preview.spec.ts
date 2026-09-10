import test from "@rcompat/test";
import { previewSchema } from "#schema/preview";

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
      run: "bun run dev",
      output: ".preview",
      watch: true,
    });
    assert(result.variables).equals({ theme: "dark" });
    assert(result.run).equals("bun run dev");
    assert(result.output).equals(".preview");
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

  test.case("rejects a non-string run", async assert => {
    let threw = false;
    try {
      previewSchema.parse({ run: 42 });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });
});