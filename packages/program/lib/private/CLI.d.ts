import type Command from "#Command";
export default class CLI {
    name: string;
    description: string;
    version: string;
    examples: string[];
    commands: Record<string, Command<any>>;
    constructor({ name, description, version, commands, examples, }: {
        name: string;
        description: string;
        version: string;
        commands: Command<any>[];
        examples?: string[];
    });
    run(args?: string[]): Promise<void>;
    showHelp(): void;
}
//# sourceMappingURL=CLI.d.ts.map