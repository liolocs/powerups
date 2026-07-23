export interface Flag {
    name: string;
    long: string;
    short: string;
    description: string;
    required?: boolean;
}
type FlagNames<T extends readonly Flag[]> = T[number]["name"];
type FlagRecord<T extends readonly Flag[]> = {
    [K in FlagNames<T>]: string | undefined;
};
type ActionProps<T extends readonly Flag[]> = FlagNames<T> extends never ? (props?: {
    flags: FlagRecord<T>;
    subcommands?: string[];
    rawFlags?: {
        flag: string;
        value: string;
    }[];
    context?: {
        root?: any;
        homeDir?: string;
    };
}) => any | Promise<any> : (props: {
    flags: FlagRecord<T>;
    subcommands?: string[];
    rawFlags?: {
        flag: string;
        value: string;
    }[];
    context?: {
        root?: any;
        homeDir?: string;
    };
}) => any | Promise<any>;
export default class Command<T extends readonly Flag[]> {
    name: string;
    description: string;
    flags: T;
    subcommands: Map<string, Command<any>>;
    requiresSubcommand?: boolean;
    action: ActionProps<T>;
    constructor({ name, description, flags, subcommands, action, requiresSubcommand, }: {
        name: string;
        description: string;
        flags: T;
        subcommands: Command<any>[];
        action: ActionProps<T>;
        requiresSubcommand?: boolean;
    });
    run(args?: {
        subcommands: string[];
        flags: {
            flag: string;
            value: string;
        }[];
        context?: {
            root?: any;
            homeDir?: string;
        };
    }): Promise<void>;
    buildHelp(): string;
    private _getMatchedFlags;
    private _hasMissingRequiredFlags;
}
export {};
//# sourceMappingURL=Command.d.ts.map