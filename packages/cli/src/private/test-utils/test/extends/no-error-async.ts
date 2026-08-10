import { type Asserter } from "@rcompat/test/index";

function assertNoErrorAsync(assert: Asserter, subject: unknown) {
  return async function noErrorAsync() {
    let threw;
    try {
      await subject;
      threw = false;
    } catch (e) {
      console.error(e);
      threw = true;
    }
    assert(threw).equals(false);
    // @ts-expect-error this has no type annotation
    return this;
  };
};

export default assertNoErrorAsync;