import is from "@rcompat/is";
import type { FileRef } from "@rcompat/fs";
import type { VariableResult } from "#utils/variables";
import runnerErrors from "#errors/runnerErrors";
import tsRunner from "#runners/ts";
import njkRunner from "#runners/njk";

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
    throw runnerErrors.unsupported_template_type(ext, ctx.templatePath);
  }

  return runner(ctx);
}