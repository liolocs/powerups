import fs from "@rcompat/fs";
import nunjucks from "nunjucks";
import runnerErrors from "#errors/runnerErrors";
import type { TemplateContext } from "#runners/output/index";

export default async function njkRunner(
  { templatePath, variables }: TemplateContext,
): Promise<string> {
  if (!(await fs.exists(templatePath))) {
    throw runnerErrors.template_not_found(templatePath.name);
  }

  const content = await templatePath.text();

  try {
    return nunjucks.renderString(content, variables);
  } catch (error_) {
    throw runnerErrors.template_execution_error(
      templatePath.name,
      error_ instanceof Error ? error_.message : String(error_),
    );
  }
}