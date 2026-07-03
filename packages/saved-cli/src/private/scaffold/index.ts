import fs, { type FileRef } from "@rcompat/fs";
import { runTemplate } from "#runners/pattern/index";
import { detectHarness, type Harness } from "#scaffold/detect";
import { writeInstructionFile } from "#scaffold/agents";
import { writeCommandFile } from "#scaffold/write";
import { CLI_NAME, MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";

const SCAFFOLD_DIR = import.meta.dirname;

export interface ScaffoldResult {
  harness: Harness;
  filesWritten: string[];
}

/**
 * Per-harness configuration: instruction file, command directory, frontmatter.
 */
const HARNESS_CONFIG: Record<Harness, {
  instructionFile: string;
  commandDir: string | null;
  frontmatter: boolean;
}> = {
  claude: { instructionFile: "CLAUDE.md", commandDir: ".claude/commands", frontmatter: false },
  opencode: { instructionFile: "AGENTS.md", commandDir: ".opencode/commands", frontmatter: true },
  pi: { instructionFile: "AGENTS.md", commandDir: ".pi/prompts", frontmatter: false },
  codex: { instructionFile: "AGENTS.md", commandDir: null, frontmatter: false },
};

const COMMANDS = [
  {
    template: "new-feature.njk",
    name: `new-${CLI_NAME}-feature`,
    description: `Search and run ${CLI_NAME} patterns for new features`,
  },
  {
    template: "brainstorm.njk",
    name: `new-${CLI_NAME}-brainstorm`,
    description: `Brainstorm a plan using ${CLI_NAME} patterns`,
  },
];

/**
 * Run the full scaffold: detect one harness, render templates, write files.
 */
export async function scaffold(
  projectRoot: FileRef,
  harnessFlag: string | undefined,
  options?: { skipGlobal?: boolean },
): Promise<ScaffoldResult> {
  // 1. Detect harness (single)
  const harness = await detectHarness(projectRoot, harnessFlag, options);
  const config = HARNESS_CONFIG[harness];

  // 2. Build render variables from constants
  const variables = { CLI_NAME, MAIN_FOLDER, PATTERNS_FOLDER };
  const filesWritten: string[] = [];

  // 3. Write instruction file (AGENTS.md or CLAUDE.md)
  const agentsRendered = await runTemplate({
    templatePath: fs.ref(`${SCAFFOLD_DIR}/agents.njk`),
    variables,
  });
  await writeInstructionFile(projectRoot, config.instructionFile, agentsRendered, CLI_NAME);
  filesWritten.push(config.instructionFile);

  // 4. Write command files (if this harness supports them)
  if (config.commandDir !== null) {
    for (const cmd of COMMANDS) {
      const rendered = await runTemplate({
        templatePath: fs.ref(`${SCAFFOLD_DIR}/${cmd.template}`),
        variables,
      });
      const outputPath = `${config.commandDir}/${cmd.name}.md`;
      const opts = config.frontmatter
        ? { frontmatter: `description: "${cmd.description}"` }
        : undefined;
      await writeCommandFile(projectRoot, outputPath, rendered, opts);
      filesWritten.push(outputPath);
    }
  }

  return { harness, filesWritten };
}