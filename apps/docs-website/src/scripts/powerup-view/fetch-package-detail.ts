const REGISTRY_BASE = "https://registry.npmjs.org";
const INSTRUCTIONS_PATH = "dist/instructions.json";
const TEMPLATE_DIR = "dist";

export type PowerupStep = CreateStep | ModifyStep | DeleteStep | ReadStep | InstallStep;

export interface CreateStep {
  type: "create";
  name: string;
  template: string;
  outputPath: string;
}

export interface ModifyStep {
  type: "modify";
  name: string;
  template: string;
  outputPath: string;
}

export interface DeleteStep {
  type: "delete";
  name: string;
  outputPath: string;
}

export interface ReadStep {
  type: "read";
  name: string;
  path: string;
  as: string;
}

export interface InstallStep {
  type: "install";
  name: string;
  dependencies?: string[];
  devDependencies?: string[];
  packageManager?: string;
}

export interface PowerupInstructions {
  name: string;
  type: "multi-use" | "single-use";
  description: string;
  variables: {
    required: string[];
    optional?: string[];
    defaults?: Record<string, string>;
  };
  intent: string[];
  steps: PowerupStep[];
}

export interface PackageDetail {
  name: string;
  description: string;
  version: string;
  license: string;
  publisherUsername: string;
  npmUrl: string;
  repositoryUrl: string | null;
  instructions: PowerupInstructions | null;
  templateFiles: Map<string, string>;
}

const KNOWN_STEP_TYPES = new Set(["create", "modify", "delete", "read", "install"]);

function isKnownStep(step: unknown): step is PowerupStep {
  if (typeof step !== "object" || step === null) {
    return false;
  }
  const type = (step as { type?: unknown }).type;
  return typeof type === "string" && KNOWN_STEP_TYPES.has(type);
}

function filterStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}

function normalizeVariables(rawVariables: unknown): PowerupInstructions["variables"] {
  if (typeof rawVariables !== "object" || rawVariables === null) {
    return { required: [] };
  }

  const variables = rawVariables as Record<string, unknown>;
  const normalized: PowerupInstructions["variables"] = {
    required: filterStringArray(variables.required),
  };

  if (Array.isArray(variables.optional)) {
    normalized.optional = filterStringArray(variables.optional);
  }
  if (isStringRecord(variables.defaults)) {
    normalized.defaults = variables.defaults;
  }

  return normalized;
}

export function parseInstructions({ instructionsJson }: { instructionsJson: string }): PowerupInstructions | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(instructionsJson);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const raw = parsed as Record<string, unknown>;

  return {
    name: typeof raw.name === "string" ? raw.name : "",
    type: raw.type === "multi-use" ? "multi-use" : "single-use",
    description: typeof raw.description === "string" ? raw.description : "",
    variables: normalizeVariables(raw.variables),
    intent: filterStringArray(raw.intent),
    steps: Array.isArray(raw.steps) ? raw.steps.filter(isKnownStep) : [],
  };
}

export function collectTemplatePaths({ instructions }: { instructions: PowerupInstructions }): string[] {
  const templatePaths = new Set<string>();

  for (const step of instructions.steps) {
    if ((step.type === "create" || step.type === "modify") && step.template !== "") {
      templatePaths.add(step.template);
    }
  }

  return [...templatePaths];
}

export function resolveTemplateContent({ templateFiles, templatePath }: {
  templateFiles: Map<string, string>;
  templatePath: string;
}): string | null {
  return templateFiles.get(TEMPLATE_DIR + "/" + templatePath) ?? null;
}
