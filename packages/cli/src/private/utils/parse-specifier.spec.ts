import test from "@rcompat/test";
import { parseSpecifier, reconstructGitSource } from "#utils/parse-specifier";

test.group("parseSpecifier", () => {
  test.case("parses npm: specifier", assert => {
    const spec = parseSpecifier("npm:react-powerups");
    assert(spec.type).equals("npm");
    assert(spec.source).equals("npm:react-powerups");
    assert(spec.name).equals("react-powerups");
    assert(spec.storePath).equals("npm/node_modules/react-powerups");
  });

  test.case("parses scoped npm: specifier", assert => {
    const spec = parseSpecifier("npm:@scope/pkg");
    assert(spec.type).equals("npm");
    assert(spec.name).equals("@scope/pkg");
    assert(spec.storePath).equals("npm/node_modules/@scope/pkg");
  });

  test.case("parses https git url", assert => {
    const spec = parseSpecifier("https://github.com/foo/bar");
    assert(spec.type).equals("git");
    assert(spec.source).equals("https://github.com/foo/bar");
    assert(spec.name).equals("foo/bar");
    assert(spec.storePath).equals("git/github.com/foo/bar");
  });

  test.case("strips .git suffix from git url", assert => {
    const spec = parseSpecifier("https://github.com/foo/bar.git");
    assert(spec.type).equals("git");
    assert(spec.storePath).equals("git/github.com/foo/bar");
  });

  test.case("parses http git url", assert => {
    const spec = parseSpecifier("http://gitlab.com/foo/bar");
    assert(spec.type).equals("git");
    assert(spec.storePath).equals("git/gitlab.com/foo/bar");
  });

  test.case("parses bare internal name", assert => {
    const spec = parseSpecifier("pwrp-internal");
    assert(spec.type).equals("internal");
    assert(spec.name).equals("pwrp-internal");
    assert(spec.storePath).equals("internal/pwrp-internal");
  });
});

test.group("reconstructGitSource", () => {
  test.case("reconstructs https source from store path", assert => {
    assert(reconstructGitSource("git/github.com/foo/bar"))
      .equals("https://github.com/foo/bar");
  });

  test.case("reconstructs gitlab source", assert => {
    assert(reconstructGitSource("git/gitlab.com/foo/bar"))
      .equals("https://gitlab.com/foo/bar");
  });
});