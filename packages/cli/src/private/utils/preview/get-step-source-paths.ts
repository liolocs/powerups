import type { Instructions } from "@liolocs/powerups-sdk";

export default function getStepSourcePaths({ instructions }: { instructions: Instructions }): string[] {
  const paths: string[] = [];

  for (const step of instructions.steps) {
    if (step.type === "create" || step.type === "modify") {
      paths.push(step.file);
    }

    if (step.type === "dynamic-create" || step.type === "dynamic-modify") {
      paths.push(step.template);
    }

    if (step.type === "read") {
      paths.push(step.path);
    }
  }

  return [...new Set(paths)];
}