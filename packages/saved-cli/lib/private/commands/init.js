import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import { Command } from "@dryai/program";
import init_errors from "#errors/initErrors";
import { scaffold } from "#scaffold/index";
import { MAIN_FOLDER, CLI_NAME } from "#constants";
const init = new Command({
    name: "init",
    description: `Initialize a ${CLI_NAME} project in the current directory`,
    flags: [
        {
            name: "harness",
            long: "harness",
            short: "H",
            description: "Override harness detection (claude|opencode|pi|codex). Repeatable.",
        },
    ],
    subcommands: [],
    action: async (props) => {
        const root = props?.context?.root ?? await runtime.projectRoot();
        const mainFolder = root.append(`/${MAIN_FOLDER}`);
        const hasDryFolder = await fs.exists(mainFolder);
        if (hasDryFolder) {
            throw init_errors.dry_folder_exists();
        }
        await fs.create(mainFolder);
        // Parse --harness flags (repeatable, comma-separated)
        const harnessFlags = [];
        if (is.defined(props?.flags?.harness) === true) {
            harnessFlags.push(...props.flags.harness.split(",").map(s => s.trim()).filter(Boolean));
        }
        // Run scaffold
        const result = await scaffold(root, harnessFlags, {
            skipGlobal: props?.context?.skipGlobal,
        });
        cli.print(`Initialized ${CLI_NAME} project`);
        cli.print(`Detected harness(es): ${result.harnesses.join(", ")}`);
        for (const file of result.filesWritten) {
            cli.print(`Wrote ${file}`);
        }
    },
});
export default init;
//# sourceMappingURL=init.js.map