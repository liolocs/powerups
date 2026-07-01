import test from "@rcompat/test";
import init from "#init";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { DRY_FOLDER } from "#constants";
const root = await runtime.projectRoot();
const dryFolder = root.append(`/${DRY_FOLDER}`);
test.case(`init generates a ${DRY_FOLDER} folder`, async (assert) => {
    if (await fs.exists(dryFolder)) {
        await dryFolder.remove();
    }
    await init.run();
    const hasDryFolder = await fs.exists(dryFolder);
    assert(hasDryFolder).equals(true);
    await dryFolder.remove();
    const hasDryFolderAgain = await fs.exists(dryFolder);
    assert(hasDryFolderAgain).equals(false);
});
//# sourceMappingURL=init.spec.js.map