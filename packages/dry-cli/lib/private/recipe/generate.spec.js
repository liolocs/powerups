import test from "@rcompat/test";
import generate from "#recipe/generate";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
const root = await runtime.projectRoot();
const dryFolder = root.append("/.dry");
const recipesFolder = dryFolder.append("/recipes");
test.case("gen recipe creates a recipe.json file", async (assert) => {
    await fs.create(dryFolder);
    await generate.run({
        subcommands: [],
        flags: [{ flag: "--name", value: "test-recipe" }],
    });
    const recipePath = recipesFolder.append("/test-recipe.json");
    const hasRecipe = await fs.exists(recipePath);
    assert(hasRecipe).equals(true);
    await dryFolder.remove();
});
test.case("gen recipe creates template files from output", async (assert) => {
    await fs.create(dryFolder);
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
    const recipePath = recipesFolder.append("/ui-component.json");
    const templatePath = recipesFolder.append("/button.svelte.tmpl");
    assert(await fs.exists(recipePath)).equals(true);
    assert(await fs.exists(templatePath)).equals(true);
    const content = await recipePath.json();
    assert(content.name).equals("ui-component");
    assert(content.intent).equals(["component", "ui"]);
    assert(content.variables).equals(["ComponentName"]);
    assert(content.output.files[0]?.name).equals("button.svelte");
    await dryFolder.remove();
});
test.case("gen recipe errors without .dry folder", async (assert) => {
    if (await fs.exists(dryFolder)) {
        await dryFolder.remove();
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
test.case("gen recipe errors when recipe already exists", async (assert) => {
    await fs.create(dryFolder);
    await generate.run({
        subcommands: [],
        flags: [{ flag: "--name", value: "dup-recipe" }],
    });
    let threw = false;
    try {
        await generate.run({
            subcommands: [],
            flags: [{ flag: "--name", value: "dup-recipe" }],
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    await dryFolder.remove();
});
//# sourceMappingURL=generate.spec.js.map