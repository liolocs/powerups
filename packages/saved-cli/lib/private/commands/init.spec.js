import test from "@rcompat/test";
import init from "#commands/init";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { MAIN_FOLDER } from "#constants";
const root = await runtime.projectRoot();
const mainFolder = root.append(`/${MAIN_FOLDER}`);
test.case(`init generates a ${MAIN_FOLDER} folder`, async (assert) => {
    if (await fs.exists(mainFolder)) {
        await mainFolder.remove();
    }
    await init.run();
    const hasDryFolder = await fs.exists(mainFolder);
    assert(hasDryFolder).equals(true);
    await mainFolder.remove();
    const hasDryFolderAgain = await fs.exists(mainFolder);
    assert(hasDryFolderAgain).equals(false);
});
//# sourceMappingURL=init.spec.js.map