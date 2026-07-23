import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import { runTemplate } from "#template-runners/index";
import { detectHarnesses, type Harness } from "#scaffold/detect";
import { writeToAgentsOrClaudeMD } from "#scaffold/agents";
import { writeSkillFile } from "#scaffold/write";
import {
  CLI_NAME,
  CLI_CMD,
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  CAPITALIZED_CLI_NAME,
  SINGULAR_NAME,
} from "#constants";

const SCAFFOLD_DIR = import.meta.dirname;

export interface ScaffoldResult {
  harnesses: Harness[];
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
  homeDir: FileRef,
  harnessFlag: string | undefined,
  options?: { rollback?: RollbackInfo },
): Promise<ScaffoldResult> {
  const harnesses = await detectHarnesses(harnessFlag, { homeDir: homeDir.path });
  const filesWritten: string[] = [];
  const rollback = options?.rollback;

  const variables = {
    CLI_NAME,
    CLI_CMD,
    MAIN_FOLDER,
    INTERNAL_FOLDER,
    SRC_FOLDER,
    ACTIVE_FOLDER,
    MULTI_USE_FOLDER,
    SINGLE_USE_FOLDER,
    CAPITALIZED_CLI_NAME,
    SINGULAR_NAME,
  };

  // Render the agents template once — same content for all harnesses
  const agentsRendered = await runTemplate({
    templatePath: fs.ref(`${SCAFFOLD_DIR}/templates/agents.njk`),
    variables,
  });

  // Render each skill template once — same content for all harnesses
  const renderedSkills = await Promise.all(
    SKILLS_TO_SCAFFOLD.map(async skill => ({
      ...skill,
      content: await runTemplate({
        templatePath: fs.ref(`${SCAFFOLD_DIR}/templates/${skill.template}`),
        variables,
      }),
    })),
  );

  for (const harness of harnesses) {
    const config = HARNESS_CONFIG[harness];

    // --- Instruction file (AGENTS.md or CLAUDE.md) ---

    // Back up the existing instruction file before modifying it, so the caller
    // can restore it on rollback. Done *after* rendering so that a render
    // failure does not create a spurious backup entry.
    const instructionRef = homeDir.append(`/${config.instructionFile}`);
    const hasExistingInstructionFile = await fs.exists(instructionRef);

    if (is.defined(rollback) && hasExistingInstructionFile) {
      rollback.restore.push({
        path: config.instructionFile,
        content: await instructionRef.text(),
      });
    }

    const hasCreatedNewAgentsOrClaudeMD = await writeToAgentsOrClaudeMD(
      homeDir,
      config.instructionFile,
      agentsRendered,
      CLI_NAME,
    );

    if (is.defined(rollback) && hasCreatedNewAgentsOrClaudeMD) {
      rollback.remove.push(config.instructionFile);
    }

    filesWritten.push(config.instructionFile);

    // --- Skill files ---

    for (const skill of renderedSkills) {
      const outputPath = `${config.skillDir}/${skill.name}.md`;

      await writeSkillFile(homeDir, outputPath, skill.content);

      if (is.defined(rollback)) {
        rollback.remove.push(outputPath);
      }

      filesWritten.push(outputPath);
    }
  }

  return { harnesses, filesWritten };
}