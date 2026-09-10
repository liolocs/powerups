import type { Step } from "@liolocs/powerups-sdk";
import template_errors from "#errors/templateErrors";

export function extractStepsArray({ indexContent }: { indexContent: string }): unknown[] {
  const bounds = findStepsArrayBounds({ indexContent });
  const arrayText = indexContent.substring(bounds.start, bounds.end + 1);

  try {
    return JSON.parse(arrayText) as unknown[];
  } catch {
    throw template_errors.steps_region_invalid("the array is not valid JSON");
  }
}

export function replaceStepsArray({
  indexContent,
  steps,
}: {
  indexContent: string;
  steps: unknown[];
}): string {
  const bounds = findStepsArrayBounds({ indexContent });
  const replacement = JSON.stringify(steps, null, 2);

  return indexContent.substring(0, bounds.start) + replacement + indexContent.substring(bounds.end + 1);
}

export function replaceStepInIndex({
  indexContent,
  stepName,
  newStep,
}: {
  indexContent: string;
  stepName: string;
  newStep: Step;
}): string {
  const steps = extractStepsArray({ indexContent });
  const index = steps.findIndex(step => (step as { name?: string }).name === stepName);

  if (index === -1) {
    throw template_errors.steps_region_invalid(`step "${stepName}" not found in the steps array`);
  }

  steps[index] = newStep;

  return replaceStepsArray({ indexContent, steps });
}

function findStepsArrayBounds({ indexContent }: { indexContent: string }): { start: number; end: number } {
  const stepsIndex = indexContent.indexOf("steps:");

  if (stepsIndex === -1) {
    throw template_errors.steps_region_invalid("no steps property found");
  }

  const openIndex = indexContent.indexOf("[", stepsIndex);

  if (openIndex === -1) {
    throw template_errors.steps_region_invalid("the steps property is not an array");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openIndex; i < indexContent.length; i++) {
    const char = indexContent[i]!;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inString && char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "[") {
      depth++;
    }

    if (char === "]") {
      depth--;

      if (depth === 0) {
        return { start: openIndex, end: i };
      }
    }
  }

  throw template_errors.steps_region_invalid("unbalanced steps array");
}
