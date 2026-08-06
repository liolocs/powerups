import test from "@rcompat/test";
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import { revertChanges } from "#utils/revert";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-revert-tmp");

async function freshRepo(): Promise<import("@rcompat/fs").FileRef> {
  const dir = tmpBase.append(`/${Date.now()}`);
  await fs.create(dir);
  await io.run("git init", { cwd: dir.path });
  await io.run("git config user.email t@t.tt && git config user.name t", { cwd: dir.path });
  await dir.append("/existing.txt").write("orig");
  await dir.append("/package.json").write("{}");
  await io.run("git add . && git commit -m init", { cwd: dir.path });
  return dir;
}

test.case("deletes created files", async assert => {
  const dir = await freshRepo();
  await dir.append("/created.txt").write("new");
  await revertChanges(dir, [{ path: "created.txt", action: "create" }]);
  assert(await fs.exists(dir.append("/created.txt"))).false();
  await dir.remove({ recursive: true });
});

test.case("restores modified files via git checkout", async assert => {
  const dir = await freshRepo();
  const baseline = await dir.append("/existing.txt").text();
  await dir.append("/existing.txt").write("changed");
  await revertChanges(dir, [{ path: "existing.txt", action: "modify" }]);
  assert(await dir.append("/existing.txt").text()).equals(baseline);
  await dir.remove({ recursive: true });
});

test.case("restores deleted files via git checkout", async assert => {
  const dir = await freshRepo();
  await dir.append("/existing.txt").remove();
  await revertChanges(dir, [{ path: "existing.txt", action: "delete" }]);
  assert(await fs.exists(dir.append("/existing.txt"))).true();
  await dir.remove({ recursive: true });
});