import test from "@rcompat/test";
import generate from "#pattern/generate";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";
const root = await runtime.projectRoot();
const mainFolder = root.append(`/${MAIN_FOLDER}`);
const patternsFolder = mainFolder.append(`/${PATTERNS_FOLDER}`);
test.case("gen pattern creates an instructions.json file", async (assert) => {
    await fs.create(mainFolder);
    await generate.run({
        subcommands: [],
        flags: [{ flag: "--name", value: "test-pattern" }],
    });
    const patternPath = patternsFolder.append("/test-pattern/instructions.json");
    const hasRecipe = await fs.exists(patternPath);
    assert(hasRecipe).equals(true);
    await mainFolder.remove();
});
test.case("gen pattern creates template files from output", async (assert) => {
    await fs.create(mainFolder);
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
    });
    const patternPath = patternsFolder.append("/ui-component/instructions.json");
    const templatePath = patternsFolder.append("/ui-component/button.svelte.tmpl");
    assert(await fs.exists(patternPath)).equals(true);
    assert(await fs.exists(templatePath)).equals(true);
    const content = await patternPath.json();
    assert(content.name).equals("ui-component");
    assert(content.intent).equals(["component", "ui"]);
    assert(content.variables).equals(["ComponentName"]);
    assert(content.output.files[0]?.name).equals("button.svelte");
    await mainFolder.remove();
});
test.case("gen pattern errors without .dry folder", async (assert) => {
    if (await fs.exists(mainFolder)) {
        await mainFolder.remove();
    }
    let threw = false;
    try {
        await generate.run({
            subcommands: [],
            flags: [{ flag: "--name", value: "should-fail" }],
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
});
test.case("gen pattern errors when pattern already exists", async (assert) => {
    await fs.create(mainFolder);
    await generate.run({
        subcommands: [],
        flags: [{ flag: "--name", value: "dup-pattern" }],
    });
    let threw = false;
    try {
        await generate.run({
            subcommands: [],
            flags: [{ flag: "--name", value: "dup-pattern" }],
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    await mainFolder.remove();
});
//# sourceMappingURL=generate.spec.js.map