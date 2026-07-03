import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { logRun, readMetrics } from "#utils/metrics";
import { MAIN_FOLDER, METRICS_FILE } from "#constants";
const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);
const metricsPath = testRoot.append(`/${MAIN_FOLDER}/${METRICS_FILE}`);
async function reset() {
    await testRoot.remove();
    await fs.create(testRoot);
    await fs.create(mainFolder);
}
test.case("logRun creates metrics file and appends entries", async (assert) => {
    await reset();
    await logRun({ pattern: "ui-component", characters: 500 }, testRoot);
    await logRun({ pattern: "api-route", characters: 1200 }, testRoot);
    assert(await fs.exists(metricsPath)).true();
    const content = await metricsPath.text();
    const lines = content.split("\n").filter(l => l.trim().length > 0);
    assert(lines.length).equals(2);
    const first = JSON.parse(lines[0]);
    assert(first.pattern).equals("ui-component");
    assert(first.characters).equals(500);
    assert(typeof first.timestamp).equals("string");
    const second = JSON.parse(lines[1]);
    assert(second.pattern).equals("api-route");
    assert(second.characters).equals(1200);
    await testRoot.remove();
});
test.case("readMetrics returns parsed entries", async (assert) => {
    await reset();
    await logRun({ pattern: "ui-component", characters: 500 }, testRoot);
    await logRun({ pattern: "ui-component", characters: 300 }, testRoot);
    await logRun({ pattern: "api-route", characters: 1200 }, testRoot);
    const entries = await readMetrics(testRoot);
    assert(entries.length).equals(3);
    assert(entries[0].pattern).equals("ui-component");
    assert(entries[0].characters).equals(500);
    assert(entries[1].pattern).equals("ui-component");
    assert(entries[1].characters).equals(300);
    assert(entries[2].pattern).equals("api-route");
    assert(entries[2].characters).equals(1200);
    await testRoot.remove();
});
test.case("readMetrics returns empty array when file missing", async (assert) => {
    await reset();
    const entries = await readMetrics(testRoot);
    assert(entries.length).equals(0);
    assert(Array.isArray(entries)).true();
    await testRoot.remove();
});
test.case("readMetrics skips blank and corrupt lines", async (assert) => {
    await reset();
    // Write a file with blank lines and corrupt JSON mixed in
    await metricsPath.write('{"timestamp":"2025-01-01T00:00:00.000Z","pattern":"good","characters":100}\n' +
        "\n" +
        "{not valid json}\n" +
        '{"timestamp":"2025-01-02T00:00:00.000Z","pattern":"also-good","characters":200}\n');
    const entries = await readMetrics(testRoot);
    assert(entries.length).equals(2);
    assert(entries[0].pattern).equals("good");
    assert(entries[1].pattern).equals("also-good");
    await testRoot.remove();
});
test.case("logRun appends to existing file without overwriting", async (assert) => {
    await reset();
    await logRun({ pattern: "first", characters: 10 }, testRoot);
    const afterFirst = await metricsPath.text();
    await logRun({ pattern: "second", characters: 20 }, testRoot);
    const afterSecond = await metricsPath.text();
    // The first entry must still be present after the second write
    assert(afterSecond.startsWith(afterFirst.trimEnd())).true();
    const entries = await readMetrics(testRoot);
    assert(entries.length).equals(2);
    await testRoot.remove();
});
//# sourceMappingURL=metrics.spec.js.map