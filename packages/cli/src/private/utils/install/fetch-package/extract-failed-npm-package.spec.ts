import test from "#test-utils/test/index";
import extractFailedNpmPackage from "#utils/install/fetch-package/extract-failed-npm-package";

test.case("should extract an unscoped package name from npm 404 stderr", async assert => {
  const stderr =
    "npm error code E404\n" +
    "npm error 404 Not Found - GET https://registry.npmjs.org/powerup-hello-world - Not found\n" +
    "npm error 404\n" +
    "npm error 404  The requested resource 'powerup-hello-world@latest' could not be found or you do not have permission to access it.\n" +
    "npm error A complete log of this run can be found in: /Users/foo/.npm/_logs/2026-09-03-debug-0.log\n";

  assert(extractFailedNpmPackage(stderr)).equals("powerup-hello-world");
});

test.case("should extract a scoped package name from npm 404 stderr", async assert => {
  const stderr =
    "npm error code E404\n" +
    "npm error 404  The requested resource '@liolocs/some-pkg@1.2.3' could not be found or you do not have permission to access it.\n";

  assert(extractFailedNpmPackage(stderr)).equals("@liolocs/some-pkg");
});

test.case("should handle a scoped package with no version suffix", async assert => {
  const stderr = "npm error 404  The requested resource '@liolocs/some-pkg' could not be found";

  assert(extractFailedNpmPackage(stderr)).equals("@liolocs/some-pkg");
});

test.case("should return null when there is no 404 resource line", async assert => {
  const stderr = "npm error code ELIFECYCLE\nnpm error something else went wrong";

  assert(extractFailedNpmPackage(stderr)).equals(null);
});