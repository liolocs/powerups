declare const command_errors: {
    missing_required_flags: (name: string) => import("@rcompat/error").TemplateError;
    invalid_subcommand: (name: string, parent: string) => import("@rcompat/error").TemplateError;
    missing_required_subcommand: (name: string, subcommands?: {
        name: string;
        description: string;
    }[]) => import("@rcompat/error").TemplateError;
};
export type CommandErrorCode = keyof typeof command_errors;
export declare const CommandErrorCode: { [K in CommandErrorCode]: K; };
export default command_errors;
//# sourceMappingURL=CommandErrors.d.ts.map