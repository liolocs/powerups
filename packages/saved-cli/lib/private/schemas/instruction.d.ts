export declare const outputSchema: import("pema").ObjectType<import("pema").NormalizeSchemaObject<{
    readonly files: import("pema").ArrayType<import("pema").ObjectType<import("pema").NormalizeSchemaObject<{
        readonly name: import("pema").StringType;
        readonly template: import("pema").StringType;
        readonly outputPath: import("pema").StringType;
    }>, undefined, {
        name: string;
        template: string;
        outputPath: string;
    }>, undefined>;
}>, undefined, {
    files: {
        name: string;
        template: string;
        outputPath: string;
    }[];
}>;
export declare const instructionsSchema: import("pema").ObjectType<import("pema").NormalizeSchemaObject<{
    readonly name: import("pema").StringType;
    readonly variables: import("pema").ArrayType<import("pema").StringType, undefined>;
    readonly intent: import("pema").ArrayType<import("pema").StringType, undefined>;
    readonly output: import("pema").ObjectType<import("pema").NormalizeSchemaObject<{
        readonly files: import("pema").ArrayType<import("pema").ObjectType<import("pema").NormalizeSchemaObject<{
            readonly name: import("pema").StringType;
            readonly template: import("pema").StringType;
            readonly outputPath: import("pema").StringType;
        }>, undefined, {
            name: string;
            template: string;
            outputPath: string;
        }>, undefined>;
    }>, undefined, {
        files: {
            name: string;
            template: string;
            outputPath: string;
        }[];
    }>;
}>, undefined, {
    name: string;
    variables: string[];
    intent: string[];
    output: {
        files: {
            name: string;
            template: string;
            outputPath: string;
        }[];
    };
}>;
export type Instructions = (typeof instructionsSchema)["infer"];
//# sourceMappingURL=instruction.d.ts.map