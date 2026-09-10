import test from "#test-utils/test/index";
import { realpathSync } from "node:fs";
import Module from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fs from "@rcompat/fs";
import resolveNodemonBin from "#utils/preview/resolve-nodemon-bin";

// proby injects NODE_PATH pointing at its own dependency store (which contains
// nodemon); clearing it reproduces the production environment where nodemon can
// only come from the powerup's own node_modules.
const moduleWithInitPaths = Module as typeof Module & { _initPaths: () => void };

function withoutNodePath(run: () => void): void {
  const originalNodePath = process.env.NODE_PATH;
  process.env.NODE_PATH = "";
  moduleWithInitPaths._initPaths();

  try {
    run();
  } finally {
    process.env.NODE_PATH = originalNodePath;
    moduleWithInitPaths._initPaths();
  }
}

test.case("resolves nodemon from the powerup root's own node_modules", async assert => {
  const powerupRoot = fs.ref(join(tmpdir(), `resolve-nodemon-bin-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  await fs.create(powerupRoot);
  await powerupRoot.append("/package.json").write(JSON.stringify({ name: "powerup-under-test", type: "module" }));
  const nodemonBin = powerupRoot.append("/node_modules/nodemon/bin/nodemon.js");
  await fs.create(nodemonBin.directory);
  await nodemonBin.write("console.log('nodemon');\n");

  assert(resolveNodemonBin({ powerupRoot })).equals(realpathSync(nodemonBin.path));

  await powerupRoot.remove({ recursive: true });
});

test.case("throws when the powerup root has no nodemon installed", async assert => {
  const powerupRoot = fs.ref(join(tmpdir(), `resolve-nodemon-bin-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  await fs.create(powerupRoot);
  await powerupRoot.append("/package.json").write(JSON.stringify({ name: "powerup-under-test", type: "module" }));

  withoutNodePath(() => assert(() => resolveNodemonBin({ powerupRoot })).throws("MODULE_NOT_FOUND"));

  await powerupRoot.remove({ recursive: true });
});