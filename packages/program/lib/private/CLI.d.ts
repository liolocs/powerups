import type Command from "#Command";
export default class CLI {
    name: string;
    description: string;
    version: string;
    commands: Record<string, Command<any>>;
    constructor({ name, description, version, commands, }: {
        name: string;
        description: string;
        version: string;
        commands: Command<any>[];
    });
    run(args?: string[]): void;
    showHelp(): void;
}
//# sourceMappingURL=CLI.d.ts.map