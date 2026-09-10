import getErrorMessage from "#errors/get-error-message";
import test from "#test-utils/test/index";

test.case("returns the message for Error instances", async assert => {
  assert(getErrorMessage(new Error("boom"))).equals("boom");
});

test.case("returns the string itself for raw string rejections", async assert => {
  assert(getErrorMessage("fatal: not a git repository")).equals("fatal: not a git repository");
});

test.case("stringifies other values instead of printing undefined", async assert => {
  assert(getErrorMessage(undefined)).equals("undefined");
  assert(getErrorMessage({ code: 128 })).equals('{"code":128}');
});

test.case("handles objects with a message property", async assert => {
  assert(getErrorMessage({ message: "from io" })).equals("from io");
});