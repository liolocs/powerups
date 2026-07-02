import type { FileRef } from "@rcompat/fs";
import type { VariableResult } from "#utils/variables";
export interface TemplateContext {
    templatePath: FileRef;
    variables: VariableResult;
}
export type TemplateRunner = (ctx: TemplateContext) => Promise<string>;
export declare function runTemplate(ctx: TemplateContext): Promise<string>;
//# sourceMappingURL=index.d.ts.map