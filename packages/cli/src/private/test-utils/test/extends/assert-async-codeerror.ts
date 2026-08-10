import { CodeError } from "@rcompat/error";
import { type Asserter } from "@rcompat/test/index";

function assertAsyncCodeError(assert: Asserter, subject: unknown) {
  return async function throwsAsync(error_code: string) {
    let threw;
    try {
      await subject;
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(error_code);
    // @ts-expect-error this has no type annotation
    return this;
  };
};

export default assertAsyncCodeError;