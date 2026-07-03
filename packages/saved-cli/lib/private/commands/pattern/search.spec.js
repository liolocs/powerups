import test from "@rcompat/test";
import search from "#commands/pattern/search";
import generate from "#commands/pattern/generate";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import captureStdout from "#test-utils/capture-stdout";
import { MAIN_FOLDER } from "#constants";
const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);
test.case("search finds matching patterns", async (assert) => {
    await testRoot.remove();
    await fs.create(testRoot);
    await fs.create(mainFolder);
    await generate.run({
        subcommands: [],
        flags: [
            { flag: "--name", value: "ui-component" },
            { flag: "--intent", value: "ui,component" },
            { flag: "--variables", value: "ComponentName" },
            { flag: "--output", value: JSON.stringify({
                    files: [
                        { name: "button.svelte",
                            template: "button.svelte.tmpl",
                            outputPath: "src/{{ComponentName}}.svelte",
                        },
                    ],
                }) },
        ],
        context: { root: testRoot },
    });
    await generate.run({
        subcommands: [],
        flags: [
            { flag: "--name", value: "api-route" },
            { flag: "--intent", value: "api,route" },
            { flag: "--variables", value: "RouteName" },
        ],
        context: { root: testRoot },
    });
    const output = await captureStdout(() => search.run({
        subcommands: [],
        flags: [{ flag: "--query", value: "component" }],
        context: { root: testRoot },
    }));
    assert(output).includes("ui-component");
    assert(output).includes("score: 1");
    await testRoot.remove();
});
test.case("search ranks by score descending", async (assert) => {
    await testRoot.remove();
    await fs.create(testRoot);
    await fs.create(mainFolder);
    await generate.run({
        subcommands: [],
        flags: [
            { flag: "--name", value: "focused" },
            { flag: "--intent", value: "component" },
        ],
        context: { root: testRoot },
    });
    await generate.run({
        subcommands: [],
        flags: [
            { flag: "--name", value: "broad" },
            { flag: "--intent", value: "component,ui,state" },
            { flag: "--output", value: JSON.stringify({
                    files: [{ name: "a", template: "a", outputPath: "a" }],
                }) },
        ],
        context: { root: testRoot },
    });
    const output = await captureStdout(() => search.run({
        subcommands: [],
        flags: [{ flag: "--query", value: "component ui" }],
        context: { root: testRoot },
    }));
    const focusedPos = output.indexOf("focused");
    const broadPos = output.indexOf("broad");
    // broad should appear first (score 2) then focused (score 1)
    assert(focusedPos > broadPos).true();
    await testRoot.remove();
});
test.case("search errors when no patterns match", async (assert) => {
    await testRoot.remove();
    await fs.create(testRoot);
    await fs.create(mainFolder);
    await generate.run({
        subcommands: [],
        flags: [
            { flag: "--name", value: "ui-component" },
            { flag: "--intent", value: "ui,component" },
        ],
        context: { root: testRoot },
    });
    let threw = false;
    try {
        await search.run({
            subcommands: [],
            flags: [{ flag: "--query", value: "nonexistent" }],
            context: { root: testRoot },
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    await testRoot.remove();
});
test.case("search errors without .dry folder", async (assert) => {
    await testRoot.remove();
    await fs.create(testRoot);
    let threw = false;
    try {
        await search.run({
            subcommands: [],
            flags: [{ flag: "--query", value: "component" }],
            context: { root: testRoot },
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    await testRoot.remove();
});
//# sourceMappingURL=search.spec.js.map