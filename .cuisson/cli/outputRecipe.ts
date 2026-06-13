import nunjucks from "nunjucks";
import fs from "@rcompat/fs"
import runtime from "@rcompat/runtime"
import path from "path"

const projectRoot = path.resolve(import.meta.dirname, "../../");
const templateRoot = path.resolve(import.meta.dirname, "../", "templates");

// const templateDir = path.resolve(path.join(runtime.cwd().directory.base, "../../", ".cuisson"));

// nunjucks.configure(templateDir)

// const outputPath = path.join(templateDir, "frontend/src/lib/components/new-component/index.ts.njk")

// const template = nunjucks.render(outputPath, {
//   componentName: "NewComponent",
// });
// console.log({ template })

export default async function outputRecipe({ recipeDirPath, files, variables }: {
  recipeDirPath: string;
  files: {
    name: string;
    template: string;
    outputPath: string;
  }[], variables: Record<string, string>
}) {
  for (const file of files) {
    if (!file.outputPath) {
      throw new Error(`Output path is required for file ${file.name}`);
    }

    const template = getTemplate({ recipeDirPath, fileName: file.template, variables });

    const pathToFile = path.resolve(projectRoot, replacePathWithVariables(file.outputPath, variables));

    await createFile({ pathToFile, content: template });
  }
}

async function createFile({ pathToFile, content }: { pathToFile: string, content: string }) {
  if (await fs.ref(pathToFile).exists()) {
    console.log(`[-] File ${pathToFile} already exists`);
    return;
  }
  await fs.ref(pathToFile).write(content);
  console.log(`[+] Created file ${pathToFile}`);
}

function getTemplate({ recipeDirPath, fileName, variables }: { recipeDirPath: string, fileName: string, variables: Record<string, string> }) {
  // !TODO: should be able to use pug or ejs as well, based on the fileName, if it conatins njk, ejs or pug
  nunjucks.configure(recipeDirPath);

  const template = nunjucks.render(fileName, variables);

  return template
}

function replacePathWithVariables(path: string, variables: Record<string, string>) {
  return path.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
    return variables[variableName];
  });
}