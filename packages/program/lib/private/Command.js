import command_errors from "#errors/CommandErrors";
import is from "@rcompat/is";
export default class Command {
    name;
    description;
    flags;
    subcommands;
    requiresSubcommand;
    action;
    constructor({ name, description, flags, subcommands, action, requiresSubcommand, }) {
        this.name = name;
        this.description = description;
        this.flags = flags;
        this.subcommands = new Map(subcommands.map(sub => [sub.name, sub]));
        this.requiresSubcommand = requiresSubcommand ?? false;
        this.action = action;
    }
    async run(args) {
        // --help short-circuits everything, always
        if (args?.flags.some(f => f.flag === "--help" || f.flag === "-h")
            === true) {
            console.log(this.buildHelp());
            return;
        }
        // Delegate to subcommand if one is provided and matches
        if (is.truthy(args?.subcommands.length)) {
            const [head, ...tail] = args.subcommands;
            const sub = this.subcommands.get(head);
            if (is.falsy(sub)) {
                throw command_errors.invalid_subcommand(head, this.name);
            }
            const flags = is.defined(args.flags) ? args.flags : [];
            return sub.run({ subcommands: tail, flags: flags });
        }
        // No subcommand — check if one is required
        if (this.subcommands.size > 0 && this.requiresSubcommand === true) {
            throw command_errors.missing_required_subcommand(this.name);
        }
        // No args at all — run bare action
        if (!is.defined(args)) {
            // @ts-expect-error — flags are optional
            return this.action({ flags: {}, subcommands: [] });
        }
        if (this._hasMissingRequiredFlags(args.flags)) {
            throw command_errors.missing_required_flags(this.name);
        }
        const passedFlags = is.defined(args.flags) ? args.flags : [];
        const matchedFlags = this._getMatchedFlags({ passedFlags });
        const subcommands = is.defined(args.subcommands) ? args.subcommands : [];
        return await this.action({ flags: matchedFlags, subcommands });
    }
    buildHelp() {
        const lines = [
            `${this.name} — ${this.description}`,
            "",
        ];
        if (this.flags.length > 0) {
            lines.push("Flags:");
            for (const flag of this.flags) {
                const required = flag.required === true ? " (required)" : "";
                const short = is.defined(flag.short) ? `-${flag.short}` : "";
                const long = is.defined(flag.long) ? `--${flag.long}` : "";
                const shortAndLong = [short, long].filter(Boolean).join(", ");
                const description = flag.description + required;
                lines.push(`  ${shortAndLong.padEnd(20)} ${description}`);
                lines.push("\n");
            }
            lines.push("");
        }
        if (this.subcommands.size > 0) {
            lines.push("Subcommands:");
            for (const [name, sub] of this.subcommands) {
                lines.push(`  ${name}  ${sub.description}`);
            }
        }
        lines.push(`  ${"--h, -help".padEnd(20)} Show this help message`);
        return lines.join("\n");
    }
    _getMatchedFlags({ passedFlags, }) {
        const result = {};
        for (const flag of this.flags) {
            const matched = passedFlags.find(f => f.flag === flag.long || f.flag === flag.short
                || f.flag === `--${flag.long}` || f.flag === `-${flag.short}`);
            result[flag.name] =
                matched?.value;
        }
        return result;
    }
    _hasMissingRequiredFlags(flags) {
        const hasNoFlagsInCommandSetup = flags.length === 0 && this.flags.length === 0;
        if (hasNoFlagsInCommandSetup) {
            return false;
        }
        function matchesFlag(flag) {
            return flags.find(f => f.flag === flag.long || f.flag === flag.short
                || f.flag === `--${flag.long}` || f.flag === `-${flag.short}`);
        }
        const missingFlags = this.flags.filter(flag => {
            if (flag.required === true) {
                return matchesFlag(flag) === undefined;
            }
            return false;
        });
        return missingFlags.length > 0;
    }
}
//# sourceMappingURL=Command.js.map