import { Command } from "@dryai/program";
declare const generate: Command<({
    name: string;
    long: string;
    short: string;
    description: string;
    required: true;
} | {
    required?: undefined;
    name: string;
    long: string;
    short: string;
    description: string;
})[]>;
export default generate;
//# sourceMappingURL=generate.d.ts.map