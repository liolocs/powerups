import type { Instructions, Step, StepOverrideValue } from "#schema/instructions";

export function defineInstructions<const I extends Instructions>(
  instructions: I,
  source: string,
): { instructions: I; source: string } {
  return { instructions, source };
}

function isInternalTemplate(template: string): boolean {
  return template.startsWith("_internal/");
}

function prefixTemplate(template: string, namespace: string): string {
  return isInternalTemplate(template) ? template : `_internal/${namespace}/${template}`;
}

function applyOverride(step: Step, override: StepOverrideValue): Step {
  // override carries every field except `name`; type must match the original
  return { ...override, name: step.name, type: step.type } as unknown as Step;
}

export function includePowerup<const I extends Instructions>(
  child: { instructions: I; source: string },
  options: {
    variables: { [K in I["variables"]["required"][number]]: string } & {
      [K in NonNullable<I["variables"]["optional"]>[number]]?: string;
    };
    excludeSteps?: I["steps"][number]["name"][];
    stepOverride?: Record<string, StepOverrideValue>;
    namespace?: string;
  },
): Step[] {
  const namespace = options.namespace ?? child.instructions.name;
  const exclude = new Set<string>((options.excludeSteps ?? []) as string[]);
  const overrides = options.stepOverride ?? {};
  const singleUse = child.instructions.type === "single-use";

  return child.instructions.steps
    .filter(step => !exclude.has(step.name))
    .map(step => {
      const overridden = overrides[step.name] ? applyOverride(step, overrides[step.name]) : step;

      // compose: parent map first (resolves against parent scope), child's existing
      // map last (transitive — may reference parent-mapped names). Sequential
      // resolution in object-key order makes the chain work at runtime.
      const existingMap = (overridden as Step & { variableMap?: Record<string, string> }).variableMap;
      const composedMap: Record<string, string> = {
        ...(options.variables as Record<string, string>),
        ...(existingMap ?? {}),
      };

      const templateField = (overridden as Step & { template?: string }).template;
      const existingSource = (overridden as Step & { __source?: string }).__source;
      const renamed = { ...overridden, name: `${namespace}:${overridden.name}` } as Step & { template?: string };

      if (templateField !== undefined) {
        renamed.template = prefixTemplate(templateField, namespace);
      }

      const withMap = {
        ...renamed,
        variableMap: composedMap,
        // transitive includes keep their own __source (the grandchild's);
        // direct child steps get the child's source.
        __source: existingSource ?? child.source,
        from: { name: child.instructions.name, singleUse },
      };

      return withMap as unknown as Step;
    });
}