import test from "@rcompat/test";
import error from "@rcompat/error";
import runtime from "@rcompat/runtime";
import {difference} from "@rcompat/array";
import p from "pema"


function test_error(){
  return error.template`test error`;
}

const errors = error.coded({
  test_error
})
type Code = keyof typeof errors;
const Code = Object.fromEntries(
  Object.keys(errors).map(k => [k, k]),
) as { [K in Code]: K };


// console.log(runtime.args);

// const [command, flag] = runtime.args;

// const parsedFlag = flag.split("=");

// const schema = p({
//   short: p.string,
//   long: p.string,
//   value: p.string,
// })

// console.log(parsedFlag);

// console.log(schema.parse(parsedFlag));
console.log("hello")

function testThrowFn() {
  throw new Error("test error");
  // throw errors.test_error
}
test.case("something", assert => {
  // type in the throws: (new (...args: any[]) => Error)
  assert(testThrowFn).throws(() => new Error("test error"));
})