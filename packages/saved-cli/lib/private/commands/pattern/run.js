import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";
import generatePatternErrors from "#errors/patternGenerateErrors";
import patternRunErrors from "#errors/patternRunErrors";
import { instructionsSchema } from "#schemas/instruction";
import { extractVariables } from "#utils/variables";
import { resolveOutputPath } from "#utils/output-path";
import { runTemplate } from "#runners/pattern/index";
import { MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";
const EXCLUDE_FLAGS = ["--dry-run", "-d", "--help", "-h"];
const run = new Command({
    name: "run",
    description: "Run a pattern, rendering templates with variables",
    flags: [
        {
            name: "dry-run",
            long: "dry-run",
            short: "d",
            description: "Print output to stdout instead of writing files",
        },
    ],
    subcommands: [],
    action: async ({ flags, subcommands, rawFlags }) => {
        // 1. Extract pattern name from positional args
        const patternName = subcommands?.[0];
        if (!is.defined(patternName)) {
            throw patternRunErrors.missing_pattern_name();
        }
        // 2. Locate .saved folder
        const root = await runtime.projectRoot();
        const mainFolder = root.append(`/${MAIN_FOLDER}`);
        const hasDryFolder = await fs.exists(mainFolder);
        if (!hasDryFolder) {
            throw generatePatternErrors.dry_folder_not_found();
        }
        // 3. Load instructions.json
        const patternsFolder = mainFolder.append(`/${PATTERNS_FOLDER}`);
        const patternFolder = patternsFolder.append(`/${patternName}`);
        const patternPath = patternFolder.append("/instructions.json");
        if (!(await fs.exists(patternFolder))) {
            throw patternRunErrors.pattern_not_found(patternName);
        }
        const instructions = instructionsSchema.parse(await patternPath.json());
        // 4. Extract & validate variables
        const variables = extractVariables(rawFlags ?? [], instructions.variables, EXCLUDE_FLAGS);
        // 5. Detect --dry-run via rawFlags (not flags, since the Command class
        //    can't distinguish "not passed" from "passed without value")
        const isDryRun = (rawFlags ?? []).some(f => f.flag === "--dry-run" || f.flag === "-d");
        // 6. Process each output file
        for (const file of instructions.output.files) {
            const templatePath = patternFolder.append(`/${file.template}`);
            if (!(await fs.exists(templatePath))) {
                throw patternRunErrors.template_not_found(file.template);
            }
            const rendered = await runTemplate({ templatePath, variables });
            const resolvedPath = resolveOutputPath(file.outputPath, variables);
            if (isDryRun) {
                cli.print(`=== ${resolvedPath} ===`);
                cli.print(rendered);
                cli.print("");
            }
            else {
                const targetPath = root.append(`/${resolvedPath}`);
                await fs.create(targetPath.directory);
                await targetPath.write(rendered);
                cli.print(`Wrote ${resolvedPath}`);
            }
        }
    },
});
export default run;
//# sourceMappingURL=run.js.map