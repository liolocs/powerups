import nunjucks from "nunjucks";
import path from "path"
import createFile from "../utils/filesystem/createFile";
import importFile from "../utils/filesystem/importFile";
import getProjectRoot from "./getProjectRoot";

const projectRoot = getProjectRoot;

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

    const template = await getTemplate({ recipeDirPath, templateName: file.template, variables });

    const pathToFile = path.resolve(projectRoot, replacePathWithVariables(file.outputPath, variables));

    await createFile({ pathToFile, content: template });
  }
}

// !TODO: should be able to use pug or ejs as well, based on the fileName, if it conatins njk, ejs or pug
const extensionToTemplate = {
  njk: getNunjucksTemplate,
  ts: getTsTemplate
} as {
  [key: string]: (arg0: { recipeDirPath: string, templateName: string, variables: Record<string, string> }) => Promise<string>
}

function getTemplate({ recipeDirPath, templateName, variables }: { recipeDirPath: string, templateName: string, variables: Record<string, string> }) {
  const extension = templateName.split(".").slice(-1)[0];
  if (!extensionToTemplate[extension]) {
    throw new Error(`Template ${templateName} is not supported`);
  }

  return extensionToTemplate[extension]({ recipeDirPath, templateName, variables });
}

async function getTsTemplate({ recipeDirPath, templateName, variables }: { recipeDirPath: string, templateName: string, variables: Record<string, string> }) {
  const filePath = path.resolve(recipeDirPath, templateName);
  const template = (await importFile(filePath)).default({ ...variables });
  return template
}

function getNunjucksTemplate({ recipeDirPath, templateName, variables }: { recipeDirPath: string, templateName: string, variables: Record<string, string> }) {
  nunjucks.configure(recipeDirPath);
  const template = nunjucks.render(templateName, variables);
  return template
}

function replacePathWithVariables(path: string, variables: Record<string, string>) {
  return path.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
    return variables[variableName];
  });
}