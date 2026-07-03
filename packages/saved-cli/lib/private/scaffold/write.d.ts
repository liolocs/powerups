import { type FileRef } from "@rcompat/fs";
interface WriteOptions {
    frontmatter?: string;
}
/**
 * Write a rendered command file to the project root.
 * Creates parent directories as needed.
 * If frontmatter is provided, prepends it as YAML frontmatter.
 */
export declare function writeCommandFile(projectRoot: FileRef, relativePath: string, content: string, options?: WriteOptions): Promise<void>;
export {};
//# sourceMappingURL=write.d.ts.map