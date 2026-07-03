import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import summary from "#commands/metrics/summary";
import captureStdout from "#test-utils/capture-stdout";
import { CodeError } from "@rcompat/error";
import { logRun } from "#utils/metrics";
import { MAIN_FOLDER } from "#constants";
const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);
async function reset() {
    await testRoot.remove();
    await fs.create(testRoot);
    await fs.create(mainFolder);
}
test.case("summary prints no-metrics message when file is empty", async (assert) => {
    await reset();
    const output = await captureStdout(() => summary.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
    }));
    assert(output).includes("No metrics recorded yet");
    await testRoot.remove();
});
test.case("summary prints no-metrics message when file missing", async (assert) => {
    await reset();
    const output = await captureStdout(() => summary.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
    }));
    assert(output).includes("No metrics recorded yet");
    await testRoot.remove();
});
test.case("summary prints table with aggregated data", async (assert) => {
    await reset();
    await logRun({ pattern: "ui-component", characters: 3000 }, testRoot);
    await logRun({ pattern: "ui-component", characters: 1500 }, testRoot);
    await logRun({ pattern: "api-route", characters: 1200 }, testRoot);
    const output = await captureStdout(() => summary.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
    }));
    // Header
    assert(output).includes("Pattern");
    assert(output).includes("Runs");
    assert(output).includes("Characters");
    assert(output).includes("Est. Tokens Saved");
    // Pattern rows — ui-component first (more characters, sorted descending)
    assert(output).includes("ui-component");
    assert(output).includes("api-route");
    // ui-component: 2 runs, 4500 characters, ~1125 tokens
    assert(output).includes("4,500");
    assert(output).includes("~1,125");
    // api-route: 1 run, 1200 characters, ~300 tokens
    assert(output).includes("1,200");
    assert(output).includes("~300");
    // Total row
    assert(output).includes("TOTAL");
    assert(output).includes("5,700");
    assert(output).includes("~1,425");
    await testRoot.remove();
});
test.case("summary throws dry_folder_not_found without .saved", async (assert) => {
    await testRoot.remove();
    await fs.create(testRoot);
    let threw = false;
    try {
        await summary.run({
            subcommands: [],
            flags: [],
            context: { root: testRoot },
        });
    }
    catch (e) {
        threw = true;
        assert(e instanceof CodeError).true();
        assert(e.code).equals("dry_folder_not_found");
    }
    assert(threw).true();
    await testRoot.remove();
});
//# sourceMappingURL=summary.spec.js.map