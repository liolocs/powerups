import test from "@rcompat/test";
import { encodeProjectPath, decodeProjectPath } from "#utils/project-path";

test.case("encodeProjectPath encodes a Unix absolute path", assert => {
  assert(encodeProjectPath("/Users/lioloc/dev/myapp")).equals("--Users-lioloc-dev-myapp--");
});

test.case("encodeProjectPath strips leading backslash (Windows)", assert => {
  assert(encodeProjectPath("\\Users\\lioloc\\dev\\myapp")).equals("--Users-lioloc-dev-myapp--");
});

test.case("encodeProjectPath replaces colons (Windows drive letters)", assert => {
  assert(encodeProjectPath("C:\\Users\\lioloc\\dev\\myapp")).equals("--C--Users-lioloc-dev-myapp--");
});

test.case("encodeProjectPath resolves relative paths", assert => {
  const encoded = encodeProjectPath(".");
  // path.resolve(".") returns process.cwd() — just check it starts and ends with --
  assert(encoded.startsWith("--")).true();
  assert(encoded.endsWith("--")).true();
});

test.case("encodeProjectPath wraps with -- prefix and suffix", assert => {
  const encoded = encodeProjectPath("/home/user/project");
  assert(encoded.startsWith("--")).true();
  assert(encoded.endsWith("--")).true();
  assert(encoded).equals("--home-user-project--");
});

test.case("decodeProjectPath reverses encoding (best-effort)", assert => {
  assert(decodeProjectPath("--Users-lioloc-dev-myapp--")).equals("Users/lioloc/dev/myapp");
});

test.case("decodeProjectPath returns inner string for unrecognized format", assert => {
  assert(decodeProjectPath("some-dir-name")).equals("some/dir/name");
});