import test from "@rcompat/test";

test.case("throws works", assert => {
  assert(() => { throw new Error("test"); }).throws(Error);
});

test.case("try-catch works", assert => {
  let threw = false;
  try {
    throw new Error("test");
  } catch {
    threw = true;
  }
  assert(threw).true();
});
