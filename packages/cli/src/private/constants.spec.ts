import test from "#test-utils/test/index";
import { globalSkillsDir, VALID_HARNESSES } from "#constants";

test.case("resolves the global skills dir under the provided home dir", async assert => {
  assert(globalSkillsDir({ harness: "pi", homeDir: "/tmp/home" }))
    .equals("/tmp/home/.pi/agent/skills");
  assert(globalSkillsDir({ harness: "claude", homeDir: "/tmp/home" }))
    .equals("/tmp/home/.claude/skills");
  assert(globalSkillsDir({ harness: "opencode", homeDir: "/tmp/home" }))
    .equals("/tmp/home/.opencode/skills");
  assert(globalSkillsDir({ harness: "codex", homeDir: "/tmp/home" }))
    .equals("/tmp/home/.codex/skills");
});

test.case("falls back to the user's home directory", async assert => {
  assert(globalSkillsDir({ harness: "pi" }).endsWith("/.pi/agent/skills")).true();
  assert(VALID_HARNESSES.length).equals(4);
});