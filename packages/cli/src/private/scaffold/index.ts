import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import { runTemplate } from "#runners/output/index";
import { detectHarness, type Harness } from "#scaffold/detect";
import { writeToAgentsOrClaudeMD } from "#scaffold/agents";
import { writeSkillFile } from "#scaffold/write";
import { CLI_NAME, MAIN_FOLDER, OUTPUTS_FOLDER } from "#constants";

const SCAFFOLD_DIR = import.meta.dirname;

export interface ScaffoldResult {
  harness: Harness;
  filesWritten: string[];
}

export interface RollbackInfo {
  remove: string[];
  restore: { path: string; content: string }[];
}

const HARNESS_CONFIG: Record<Harness, {
  instructionFile: string;
  skillDir: string;
  frontmatter: boolean;
}> = {
  claude: {
    instructionFile: "CLAUDE.md",
    skillDir: ".claude/skills",
    frontmatter: false,
  },
  opencode: {
    instructionFile: "AGENTS.md",
    skillDir: ".opencode/skills",
    frontmatter: true,
  },
  pi: {
    instructionFile: "AGENTS.md",
    skillDir: ".pi/skills",
    frontmatter: false,
  },
  codex: {
    instructionFile: "AGENTS.md",
    skillDir: ".codex/skills",
    frontmatter: false,
  },
};

const COMMANDS = [
  {
    template: "saved-feature.njk",
    name: `${CLI_NAME}-feature`,
    description: `Search and run ${CLI_NAME} outputs for new features`,
  },
  {
    template: "saved-brainstorm.njk",
    name: `${CLI_NAME}-brainstorm`,
    description: `Brainstorm a plan using ${CLI_NAME} outputs`,
  },
  {
    template: "saved-output.njk",
    name: `${CLI_NAME}-output`,
    description: `Analyze existing code and capture repeatable patterns as ${CLI_NAME} outputs`,
  },
];

export async function scaffold(
  projectRoot: FileRef,
  harnessFlag: string | undefined,
  options?: { skipGlobal?: boolean; rollback?: RollbackInfo },
): Promise<ScaffoldResult> {
  // 1. Detect harness (single)
  const harness = await detectHarness(projectRoot, harnessFlag, options);
  const config = HARNESS_CONFIG[harness];

  // 2. Build render variables from constants
  const variables = { CLI_NAME, MAIN_FOLDER, OUTPUTS_FOLDER };
  const filesWritten: string[] = [];
  const rollback = options?.rollback;

  // 3. Write instruction file (AGENTS.md or CLAUDE.md)
  const agentsRendered = await runTemplate({
    templatePath: fs.ref(`${SCAFFOLD_DIR}/agents.njk`),
    variables,
  });

  // Back up the existing instruction file before modifying it, so the caller
  // can restore it on rollback.  Done *after* rendering so that a render
  // failure does not create a spurious backup entry.
  const instructionRef = projectRoot.append(`/${config.instructionFile}`);
  const hasExistingInstructionFile = await fs.exists(instructionRef);

  if (is.defined(rollback) && hasExistingInstructionFile) {
    rollback.restore.push({
      path: config.instructionFile,
      content: await instructionRef.text(),
    });
  }

  const hasCreatedNewAgentsOrClaudeMD = await writeToAgentsOrClaudeMD(
    projectRoot,
    config.instructionFile,
    agentsRendered,
    CLI_NAME,
  );

  if (is.defined(rollback) && hasCreatedNewAgentsOrClaudeMD) {
    rollback.remove.push(config.instructionFile);
  }

  filesWritten.push(config.instructionFile);

  // 4. Write skill files
  for (const cmd of COMMANDS) {
    const rendered = await runTemplate({
      templatePath: fs.ref(`${SCAFFOLD_DIR}/${cmd.template}`),
      variables,
    });
    const outputPath = `${config.skillDir}/${cmd.name}.md`;
    const opts = is.defined(config.frontmatter) && is.truthy(config.frontmatter)
      ? { frontmatter: `name: ${cmd.name}\ndescription: "${cmd.description}"` }
      : undefined;
    await writeSkillFile(projectRoot, outputPath, rendered, opts);

    if (is.defined(rollback)) {
      rollback.remove.push(outputPath);
    }

    filesWritten.push(outputPath);
  }

  return { harness, filesWritten };
}