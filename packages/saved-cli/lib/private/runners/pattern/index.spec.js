import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { runTemplate } from "#runners/pattern/index";
import { CodeError } from "@rcompat/error";
const root = await runtime.projectRoot();
const tmpDir = root.append("/.test-runner-tmp");
test.case("dispatcher throws for unsupported extension", async (assert) => {
    await fs.create(tmpDir);
    const templatePath = tmpDir.append("/template.txt");
    await templatePath.write("hello");
    let threw = false;
    try {
        await runTemplate({ templatePath, variables: {} });
    }
    catch (e) {
        threw = true;
        assert(e instanceof CodeError).true();
        assert(e.code).equals("unsupported_template_type");
    }
    assert(threw).true();
    await tmpDir.remove();
});
//# sourceMappingURL=index.spec.js.map