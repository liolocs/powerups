import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import { runTemplate } from "#template-runners/index";
import { detectHarness, type Harness } from "#scaffold/detect";
import { writeToAgentsOrClaudeMD } from "#scaffold/agents";
import { writeSkillFile } from "#scaffold/write";
import {
  CLI_NAME,
  CLI_CMD,
  MAIN_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
} from "#constants";

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
}> = {
  claude: {
    instructionFile: "CLAUDE.md",
    skillDir: ".claude/skills",
  },
  opencode: {
    instructionFile: "AGENTS.md",
    skillDir: ".opencode/skills",
  },
  pi: {
    instructionFile: "AGENTS.md",
    skillDir: ".pi/skills",
  },
  codex: {
    instructionFile: "AGENTS.md",
    skillDir: ".codex/skills",
  },
};

// Each template carries its own YAML frontmatter (name + description), so the
// harness no longer needs to inject frontmatter conditionally — every skill
// file gets the same frontmatter regardless of the target harness.
const SKILLS_TO_SCAFFOLD = [
  {
    template: `${CLI_NAME}-brainstorm.njk`,
    name: `${CLI_NAME}-brainstorm`,
  },
  {
    template: `${CLI_NAME}-implement.njk`,
    name: `${CLI_NAME}-implement`,
  },
  {
    template: `${CLI_NAME}-capture.njk`,
    name: `${CLI_NAME}-capture`,
  },
];

export async function scaffold(
  projectRoot: FileRef,
  harnessFlag: string | undefined,
  options?: { skipGlobal?: boolean; rollback?: RollbackInfo },
): Promise<ScaffoldResult> {
  const harness = await detectHarness(projectRoot, harnessFlag, options);
  const config = HARNESS_CONFIG[harness];

  const variables = {
    CLI_NAME,
    CLI_CMD,
    MAIN_FOLDER,
    ACTIVE_FOLDER,
    MULTI_USE_FOLDER,
    SINGLE_USE_FOLDER,
  };
  const filesWritten: string[] = [];
  const rollback = options?.rollback;

  // output is either (AGENTS.md or CLAUDE.md)
  const agentsRendered = await runTemplate({
    templatePath: fs.ref(`${SCAFFOLD_DIR}/templates/agents.njk`),
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

  for (const skill of SKILLS_TO_SCAFFOLD) {
    const rendered = await runTemplate({
      templatePath: fs.ref(`${SCAFFOLD_DIR}/templates/${skill.template}`),
      variables,
    });

    const outputPath = `${config.skillDir}/${skill.name}.md`;

    await writeSkillFile(projectRoot, outputPath, rendered);

    if (is.defined(rollback)) {
      rollback.remove.push(outputPath);
    }

    filesWritten.push(outputPath);
  }

  return { harness, filesWritten };
}