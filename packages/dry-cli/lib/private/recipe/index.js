import { Command } from "@dryai/program";
import generate from "#recipe/generate";
import search from "#recipe/search";
const recipe = new Command({
    name: "recipe",
    description: "Manage dryai recipes",
    flags: [],
    subcommands: [generate, search],
    requiresSubcommand: true,
    action: () => { },
});
export default recipe;
//# sourceMappingURL=index.js.map