import type {
  CreateStep,
  DynamicCreateStep,
  DynamicModifyStep,
  ModifyStep,
  Step,
} from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import { modificationArraySchema } from "#schemas/modification";
import template_errors from "#errors/templateErrors";
import generateReadableTemplate from "#utils/template-conversion/generate-readable-template";
import { runTemplate } from "#template-runners/index";

export type TemplateEngine = "ts" | "njk";

const UNSET_VARIABLE_SENTINEL = "__PUP_UNSET_VARIABLE__";

export function convertStepToDynamic({
  step,
  sourceContent,
  engine,
}: {
  step: CreateStep | ModifyStep;
  sourceContent: string;
  engine: TemplateEngine;
}): { newStep: Step; templatePath: string; templateContent: string } {
  const isModify = step.type === "modify";
  const directory = isModify ? "src/dynamic-modify" : "src/dynamic-create";
  const suffix = engine === "njk" ? ".njk" : isModify ? ".modify.ts" : ".ts";
  const templatePath = `${directory}/${step.outputPath}${suffix}`;

  const templateContent = engine === "njk"
    ? sourceContent
    : generateReadableTemplate({ content: sourceContent });

  const { file: _omit, ...rest } = step;

  const newStep: Step = isModify
    ? { ...rest, type: "dynamic-modify", template: templatePath }
    : { ...rest, type: "dynamic-create", template: templatePath };

  return { newStep, templatePath, templateContent };
}

export async function revertStepToStatic({
  step,
  powerupRoot,
  variables,
  declaredVariableNames,
}: {
  step: DynamicCreateStep | DynamicModifyStep;
  powerupRoot: FileRef;
  variables: Record<string, string>;
  declaredVariableNames: string[];
}): Promise<{ newStep: Step; staticPath: string; staticContent: string; templatePath: string }> {
  const templatePathRef = powerupRoot.append(`/${step.template}`);

  if (!(await templatePathRef.exists())) {
    throw template_errors.steps_region_invalid(`template file "${step.template}" not found`);
  }

  const sentinelVariables = buildSentinelVariables({ variables, declaredVariableNames });

  const sentinelRender = await runTemplate({
    templatePath: templatePathRef,
    variables: sentinelVariables,
  });

  if (sentinelRender.includes(UNSET_VARIABLE_SENTINEL)) {
    const missing = declaredVariableNames.filter(name =>
      is.falsy(variables[name]),
    );

    throw template_errors.revert_needs_variables(missing);
  }

  if (step.type === "dynamic-modify") {
    let parsed: unknown;

    try {
      parsed = JSON.parse(sentinelRender);
    } catch {
      throw template_errors.steps_region_invalid("the rendered template is not valid JSON modifications");
    }

    const modifications = modificationArraySchema.parse(parsed);
    const staticContent = JSON.stringify(modifications, null, 2);
    const staticPath = `src/modify/${step.outputPath}.json`;
    const { template: _omit, ...rest } = step;

    return {
      newStep: { ...rest, type: "modify", file: staticPath },
      staticPath,
      staticContent,
      templatePath: step.template,
    };
  }

  const staticPath = `src/create/${step.outputPath}`;
  const { template: _omit, ...rest } = step;

  return {
    newStep: { ...rest, type: "create", file: staticPath },
    staticPath,
    staticContent: sentinelRender,
    templatePath: step.template,
  };
}

function buildSentinelVariables({
  variables,
  declaredVariableNames,
}: {
  variables: Record<string, string>;
  declaredVariableNames: string[];
}): Record<string, string> {
  const sentinelVariables: Record<string, string> = {};

  for (const name of declaredVariableNames) {
    const value = variables[name];
    sentinelVariables[name] = is.falsy(value) ? UNSET_VARIABLE_SENTINEL : value;
  }

  return sentinelVariables;
}
