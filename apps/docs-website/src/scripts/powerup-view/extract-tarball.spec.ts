import { readFile } from "node:fs/promises";
import test from "@rcompat/test";
import { extractTarball } from "./extract-tarball.ts";

test.case("extracts files from a powerup tarball without the package prefix", async assert => {
  const tarballUrl = new URL("./test-fixtures/hello-world.tgz", import.meta.url);
  const tarballBytes = new Uint8Array(await readFile(tarballUrl));
  const files = extractTarball({ tarballBytes });

  assert(files.has("package.json")).equals(true);
  assert(files.has("dist/instructions.json")).equals(true);
  assert(files.has("dist/src/index.ts")).equals(true);

  const instructions = JSON.parse(files.get("dist/instructions.json") ?? "{}") as { name?: string; steps?: unknown[] };
  assert(instructions.name).equals("powerup-hello-world");
  assert(instructions.steps?.length).equals(2);

  const template = files.get("dist/src/index.ts") ?? "";
  assert(template.includes("Hello World")).equals(true);
});
