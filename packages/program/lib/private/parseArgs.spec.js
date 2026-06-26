import test from "@rcompat/test";
import parseArgs from "#parseArgs";
test.case("A series of args are recognised", assert => {
    const args = ["-n=John", "--project=calypso"];
    const parsed = parseArgs(args);
    assert(parsed.flags.length).equals(2);
    assert(parsed.commands.length).equals(0);
});
test.case("A series of args with commands are recognised", assert => {
    const args = ["create", "-n=John", "--project=calypso"];
    const parsed = parseArgs(args);
    assert(parsed.flags.length).equals(2);
    assert(parsed.commands.length).equals(1);
});
test.case("A series of flags have correct values", assert => {
    const args = ["-n=John", "--project=calypso"];
    const parsed = parseArgs(args);
    assert(parsed.flags.length).equals(2);
    assert(parsed.flags[0].value).equals("John");
    assert(parsed.flags[1].value).equals("calypso");
});
//# sourceMappingURL=parseArgs.spec.js.map