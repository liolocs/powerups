import fs from "@rcompat/fs";
import nunjucks from "nunjucks";
import outputRunErrors from "#errors/outputRunErrors";
import type { TemplateContext } from "#runners/output/index";

export default async function njkRunner(
  { templatePath, variables }: TemplateContext,
): Promise<string> {
  if (!(await fs.exists(templatePath))) {
    throw outputRunErrors.template_not_found(templatePath.name);
  }

  const content = await templatePath.text();

  try {
    return nunjucks.renderString(content, variables);
  } catch (error_) {
    throw outputRunErrors.template_execution_error(
      templatePath.name,
      error_ instanceof Error ? error_.message : String(error_),
    );
  }
}