import test from "@rcompat/test";
import generate from "#commands/pattern/generate";
import { instructionsSchema } from "#schemas/instruction";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";
const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);
const patternsFolder = mainFolder.append(`/${PATTERNS_FOLDER}`);
async function reset() {
    await testRoot.remove();
    await fs.create(testRoot);
    await fs.create(mainFolder);
}
test.case("gen pattern creates an instructions.json file", async (assert) => {
    await reset();
    await generate.run({
        subcommands: [],
        flags: [{ flag: "--name", value: "test-pattern" }],
        context: { root: testRoot },
    });
    const patternPath = patternsFolder.append("/test-pattern/instructions.json");
    const hasPattern = await fs.exists(patternPath);
    assert(hasPattern).equals(true);
    await testRoot.remove();
});
test.case("gen pattern creates template files from output", async (assert) => {
    await reset();
    const output = JSON.stringify({
        files: [{
                name: "button.svelte",
                template: "button.svelte.tmpl",
                outputPath: "src/{{ComponentName}}.svelte",
            }],
    });
    await generate.run({
        subcommands: [],
        flags: [
            { flag: "--name", value: "ui-component" },
            { flag: "--intent", value: "component,ui" },
            { flag: "--variables", value: "ComponentName" },
            { flag: "--output", value: output },
        ],
        context: { root: testRoot },
    });
    const patternPath = patternsFolder.append("/ui-component/instructions.json");
    const templatePath = patternsFolder.append("/ui-component/button.svelte.tmpl");
    assert(await fs.exists(patternPath)).equals(true);
    assert(await fs.exists(templatePath)).equals(true);
    const content = instructionsSchema.parse(await patternPath.json());
    assert(content.name).equals("ui-component");
    assert(content.intent).equals(["component", "ui"]);
    assert(content.variables).equals(["ComponentName"]);
    assert(content.output.files[0]?.name).equals("button.svelte");
    await testRoot.remove();
});
test.case("gen pattern errors without .dry folder", async (assert) => {
    await testRoot.remove();
    await fs.create(testRoot);
    let threw = false;
    try {
        await generate.run({
            subcommands: [],
            flags: [{ flag: "--name", value: "should-fail" }],
            context: { root: testRoot },
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    await testRoot.remove();
});
test.case("gen pattern errors when pattern already exists", async (assert) => {
    await reset();
    await generate.run({
        subcommands: [],
        flags: [{ flag: "--name", value: "dup-pattern" }],
        context: { root: testRoot },
    });
    let threw = false;
    try {
        await generate.run({
            subcommands: [],
            flags: [{ flag: "--name", value: "dup-pattern" }],
            context: { root: testRoot },
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    await testRoot.remove();
});
//# sourceMappingURL=generate.spec.js.map