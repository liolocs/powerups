export default function captureStdout(fn: () => Promise<unknown>): Promise<string>;
export declare function captureStdoutOrError(fn: () => Promise<unknown>): Promise<{
    output: string;
    error: unknown;
}>;
//# sourceMappingURL=capture-stdout.d.ts.map