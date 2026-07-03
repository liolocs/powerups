import fs, { type FileRef } from "@rcompat/fs";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import { runTemplate } from "#runners/pattern/index";
import { resolveOutputPath } from "#utils/output-path";
import { detectHarnesses, type Harness } from "#scaffold/detect";
import { writeAgentsMd } from "#scaffold/agents";
import { linkClaudeMd } from "#scaffold/claude-md";
import { writeCommandFile } from "#scaffold/write";
import init_errors from "#errors/initErrors";
import { CLI_NAME, MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";

const SCAFFOLD_DIR = import.meta.dirname;

export interface ScaffoldResult {
  harnesses: Harness[];
  filesWritten: string[];
}

/**
 * Map an output file's path to the harness it belongs to.
 * AGENTS.md → always (null = all harnesses).
 * .claude/ → claude, .opencode/ → opencode, .pi/ → pi.
 */
function fileHarness(outputPath: string): Harness | null {
  if (outputPath === "AGENTS.md") return null;
  if (outputPath.startsWith(".claude/")) return "claude";
  if (outputPath.startsWith(".opencode/")) return "opencode";
  if (outputPath.startsWith(".pi/")) return "pi";
  return null;
}

/**
 * Run the full scaffold: detect harnesses, render templates, write files.
 */
export async function scaffold(
  projectRoot: FileRef,
  harnessFlags: string[],
): Promise<ScaffoldResult> {
  // 1. Detect harnesses
  const harnesses = await detectHarnesses(projectRoot, harnessFlags);

  if (harnesses.length === 0) {
    throw init_errors.no_harness_detected();
  }

  // 2. Load bundled instructions.json
  const instructionsPath = fs.ref(`${SCAFFOLD_DIR}/instructions.json`);
  const instructions: Instructions = instructionsSchema.parse(
    await instructionsPath.json(),
  );

  // 3. Build render variables from constants
  const variables = {
    CLI_NAME,
    MAIN_FOLDER,
    PATTERNS_FOLDER,
  };

  const filesWritten: string[] = [];
  const harnessSet = new Set<Harness>(harnesses);

  // 4. Process each output file
  for (const file of instructions.output.files) {
    const harness = fileHarness(file.outputPath);

    // Skip files that belong to a harness not in our set
    if (harness !== null && !harnessSet.has(harness)) {
      continue;
    }

    // Resolve outputPath with constants
    const resolvedPath = resolveOutputPath(file.outputPath, variables);

    // Render the template
    const templatePath = fs.ref(`${SCAFFOLD_DIR}/${file.template}`);
    const rendered = await runTemplate({ templatePath, variables });

    // Handle AGENTS.md specially
    if (file.outputPath === "AGENTS.md") {
      await writeAgentsMd(projectRoot, rendered, CLI_NAME);
      filesWritten.push("AGENTS.md");
      continue;
    }

    // Handle opencode frontmatter
    const opts = file.outputPath.startsWith(".opencode/")
      ? {
          frontmatter: `description: "${
            file.template === "new-feature.njk"
              ? `Search and run ${CLI_NAME} patterns for new features`
              : `Brainstorm a plan using ${CLI_NAME} patterns`
          }"`,
        }
      : undefined;

    await writeCommandFile(projectRoot, resolvedPath, rendered, opts);
    filesWritten.push(resolvedPath);
  }

  // 5. Handle CLAUDE.md symlink (only if claude in harness set)
  if (harnessSet.has("claude")) {
    await linkClaudeMd(projectRoot);
    filesWritten.push("CLAUDE.md");
  }

  return { harnesses, filesWritten };
}