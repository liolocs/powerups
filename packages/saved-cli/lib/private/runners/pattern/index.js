import is from "@rcompat/is";
import patternRunErrors from "#errors/patternRunErrors";
import tsRunner from "#runners/pattern/ts";
import njkRunner from "#runners/pattern/njk";
const runners = {
    ".ts": tsRunner,
    ".njk": njkRunner,
};
export async function runTemplate(ctx) {
    const ext = ctx.templatePath.extension;
    const runner = runners[ext];
    if (!is.defined(runner)) {
        throw patternRunErrors.unsupported_template_type(ext, ctx.templatePath);
    }
    return runner(ctx);
}
//# sourceMappingURL=index.js.map