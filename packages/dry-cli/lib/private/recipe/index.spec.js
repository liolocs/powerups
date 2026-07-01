import test from "@rcompat/test";
import recipe from "#recipe/index";
import { CommandErrorCode } from "@dryai/program";
test.case("recipe command fails without subcommands", async (assert) => {
    let threw = false;
    let errorMessage;
    try {
        await recipe.run({
            subcommands: [],
            flags: [],
        });
    }
    catch (e) {
        threw = true;
        errorMessage = String(e.code);
    }
    assert(threw).equals(true);
    assert(errorMessage).equals(CommandErrorCode.missing_required_subcommand);
});
//# sourceMappingURL=index.spec.js.map