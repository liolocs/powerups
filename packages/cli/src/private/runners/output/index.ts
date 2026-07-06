import is from "@rcompat/is";
import type { FileRef } from "@rcompat/fs";
import type { VariableResult } from "#utils/variables";
import outputRunErrors from "#errors/outputRunErrors";
import tsRunner from "#runners/output/ts";
import njkRunner from "#runners/output/njk";

export interface TemplateContext {
  templatePath: FileRef;
  variables: VariableResult;
}

export type TemplateRunner = (ctx: TemplateContext) => Promise<string>;

const runners: Record<string, TemplateRunner> = {
  ".ts": tsRunner,
  ".njk": njkRunner,
};

export async function runTemplate(ctx: TemplateContext): Promise<string> {
  const ext = ctx.templatePath.extension;
  const runner = runners[ext];

  if (!is.defined(runner)) {
    throw outputRunErrors.unsupported_template_type(ext, ctx.templatePath);
  }

  return runner(ctx);
}