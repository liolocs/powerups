import test from "@rcompat/test";
import assertAsyncCodeError from "#test-utils/test/extends/assert-async-codeerror";
import assertNoErrorAsync from "#test-utils/test/extends/no-error-async";

const extendedTest = test.extend((assert, subject) => ({
  throwsAsync: assertAsyncCodeError(assert, subject),
  noErrorAsync: assertNoErrorAsync(assert, subject),
}));

export default extendedTest;

