import fs from "@rcompat/fs";
import is from "@rcompat/is";
import { runTemplate } from "#runners/pattern/index";
import { detectHarness } from "#scaffold/detect";
import { writeToAgentsOrClaudeMD } from "#scaffold/agents";
import { writeCommandFile } from "#scaffold/write";
import { CLI_NAME, MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";
const SCAFFOLD_DIR = import.meta.dirname;
const HARNESS_CONFIG = {
    claude: {
        instructionFile: "CLAUDE.md",
        commandDir: ".claude/commands",
        frontmatter: false,
    },
    opencode: {
        instructionFile: "AGENTS.md",
        commandDir: ".opencode/commands",
        frontmatter: true,
    },
    pi: {
        instructionFile: "AGENTS.md",
        commandDir: ".pi/prompts",
        frontmatter: false,
    },
    codex: {
        instructionFile: "AGENTS.md",
        commandDir: null,
        frontmatter: false,
    },
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
export async function scaffold(projectRoot, harnessFlag, options) {
    // 1. Detect harness (single)
    const harness = await detectHarness(projectRoot, harnessFlag, options);
    const config = HARNESS_CONFIG[harness];
    // 2. Build render variables from constants
    const variables = { CLI_NAME, MAIN_FOLDER, PATTERNS_FOLDER };
    const filesWritten = [];
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
    const hasCreatedNewAgentsOrClaudeMD = await writeToAgentsOrClaudeMD(projectRoot, config.instructionFile, agentsRendered, CLI_NAME);
    if (is.defined(rollback) && hasCreatedNewAgentsOrClaudeMD) {
        rollback.remove.push(config.instructionFile);
    }
    filesWritten.push(config.instructionFile);
    // 4. Write command files (if this harness supports them)
    if (config.commandDir !== null) {
        for (const cmd of COMMANDS) {
            const rendered = await runTemplate({
                templatePath: fs.ref(`${SCAFFOLD_DIR}/${cmd.template}`),
                variables,
            });
            const outputPath = `${config.commandDir}/${cmd.name}.md`;
            const opts = is.defined(config.frontmatter)
                ? { frontmatter: `description: "${cmd.description}"` }
                : undefined;
            await writeCommandFile(projectRoot, outputPath, rendered, opts);
            if (is.defined(rollback)) {
                rollback.remove.push(outputPath);
            }
            filesWritten.push(outputPath);
        }
    }
    return { harness, filesWritten };
}
//# sourceMappingURL=index.js.map