import test from "#test-utils/test/index";
import parseSource from "#utils/install/parse-source/index";

test.case("should parse an npm source with the package name and correct store path", async assert => {
  const result = parseSource("npm:@scope/pkg");

  assert(result.type).equals("npm");
  assert(result.configEntry).equals("npm:@scope/pkg");
  assert(result.storePath).equals("installed/npm/node_modules/@scope/pkg");
  assert(result.cloneUrl).undefined();
});

test.case("should parse a git shorthand source with the correct store path and https clone url", async assert => {
  const result = parseSource("git:github.com/owner/repo");

  assert(result.type).equals("git");
  assert(result.configEntry).equals("git:github.com/owner/repo");
  assert(result.storePath).equals("installed/git/github.com/owner/repo");
  assert(result.cloneUrl).equals("https://github.com/owner/repo");
});

test.case("should parse a git https source with .git suffix preserving the full url as config entry", async assert => {
  const result = parseSource("https://github.com/owner/repo.git");

  assert(result.type).equals("git");
  assert(result.configEntry).equals("https://github.com/owner/repo.git");
  assert(result.storePath).equals("installed/git/github.com/owner/repo");
  assert(result.cloneUrl).equals("https://github.com/owner/repo.git");
});

test.case("should parse a git https source without .git suffix", async assert => {
  const result = parseSource("https://github.com/owner/repo");

  assert(result.type).equals("git");
  assert(result.storePath).equals("installed/git/github.com/owner/repo");
  assert(result.cloneUrl).equals("https://github.com/owner/repo");
});

test.case("should parse a git ssh source with .git suffix", async assert => {
  const result = parseSource("git@github.com:owner/repo.git");

  assert(result.type).equals("git");
  assert(result.configEntry).equals("git@github.com:owner/repo.git");
  assert(result.storePath).equals("installed/git/github.com/owner/repo");
  assert(result.cloneUrl).equals("git@github.com:owner/repo.git");
});

test.case("should parse a git ssh source without .git suffix", async assert => {
  const result = parseSource("git@github.com:owner/repo");

  assert(result.type).equals("git");
  assert(result.storePath).equals("installed/git/github.com/owner/repo");
  assert(result.cloneUrl).equals("git@github.com:owner/repo");
});

test.case("should parse a bare name as internal type", async assert => {
  const result = parseSource("my-powerup");

  assert(result.type).equals("internal");
  assert(result.configEntry).equals("my-powerup");
  assert(result.storePath).equals("installed/_internal/my-powerup");
  assert(result.cloneUrl).undefined();
});

test.case("should parse an internal: prefixed source and strip the prefix from storePath", async assert => {
  const result = parseSource("internal:my-powerup");

  assert(result.type).equals("internal");
  assert(result.configEntry).equals("internal:my-powerup");
  assert(result.storePath).equals("installed/_internal/my-powerup");
  assert(result.cloneUrl).undefined();
});

test.case("should parse an http git source", async assert => {
  const result = parseSource("http://gitlab.com/owner/repo.git");

  assert(result.type).equals("git");
  assert(result.storePath).equals("installed/git/gitlab.com/owner/repo");
  assert(result.cloneUrl).equals("http://gitlab.com/owner/repo.git");
});