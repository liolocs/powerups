export default function parseArgs(args) {
    const flags = args.filter(arg => arg.startsWith("-") || arg.startsWith("--"));
    return {
        flags: flags.map(flag => {
            const [name, value] = flag.split("=");
            return { flag: name, value };
        }),
        commands: args.filter(arg => !arg.startsWith("-")),
    };
}
//# sourceMappingURL=parseArgs.js.map