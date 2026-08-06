import test from "@rcompat/test";
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import { verifyGitRepo, ensureCleanTree } from "#utils/git";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-git-tmp");

async function freshRepo(): Promise<import("@rcompat/fs").FileRef> {
  const dir = tmpBase.append(`/${Date.now()}`);
  await fs.create(dir);
  await io.run("git init", { cwd: dir.path });
  await io.run("git config user.email t@t.tt && git config user.name t", { cwd: dir.path });
  await dir.append("/a.txt").write("a");
  await io.run("git add . && git commit -m init", { cwd: dir.path });
  return dir;
}

test.case("verifyGitRepo passes in a repo", async assert => {
  const dir = await freshRepo();
  await verifyGitRepo(dir);
  assert(true).true();
  await dir.remove({ recursive: true });
});

test.case("ensureCleanTree passes when clean", async assert => {
  const dir = await freshRepo();
  await ensureCleanTree(dir);
  assert(true).true();
  await dir.remove({ recursive: true });
});

test.case("ensureCleanTree throws when there are uncommitted changes", async assert => {
  const dir = await freshRepo();
  await dir.append("/a.txt").write("dirty");
  let threw = false;
  try {
    await ensureCleanTree(dir);
  } catch {
    threw = true;
  }
  assert(threw).true();
  await dir.remove({ recursive: true });
});