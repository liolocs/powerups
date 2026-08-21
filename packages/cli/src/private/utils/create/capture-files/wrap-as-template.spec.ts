import test from "#test-utils/test/index";
import wrapAsTemplate from "#utils/create/capture-files/wrap-as-template";

test.case("should wrap simple content as a default-exported function returning the content as a string", async assert => {
  const result = wrapAsTemplate("hello world");

  assert(result).includes("export default function");
  assert(result).includes('"hello world"');
  assert(result).includes("return");
});

test.case("should escape special characters (quotes, backslashes, newlines) safely via JSON.stringify", async assert => {
  const result = wrapAsTemplate('line1\nline2 "quoted" \\backslash');

  assert(result).includes('\\n');
  assert(result).includes('\\"quoted\\"');
  assert(result).includes('\\\\backslash');
});

test.case("should wrap empty content as a function returning an empty string", async assert => {
  const result = wrapAsTemplate("");

  assert(result).includes('""');
  assert(result).includes("export default function");
});