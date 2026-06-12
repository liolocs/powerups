import nunjucks from "nunjucks";
import fs from "@rcompat/fs"
import runtime from "@rcompat/runtime"
import path from "path"

const templateDir = path.resolve(path.join(runtime.cwd().directory.base, "../../", ".cuisson"));

nunjucks.configure(templateDir)

const outputPath = path.join(templateDir, "frontend/src/lib/components/new-component/index.ts.njk") 

const template = nunjucks.render(outputPath, {
  componentName: "NewComponent",
});

console.log({ template })