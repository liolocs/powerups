/**
 * Resolve {{var}} tokens in an outputPath string using the variables record.
 * Matching is case-insensitive: {{ComponentName}} matches key componentName.
 * Unresolved tokens are left as-is.
 */
export function resolveOutputPath(outputPath, variables) {
    return outputPath.replace(/\{\{(\w+)\}\}/g, (match, token) => {
        const key = Object.keys(variables).find(k => k.toLowerCase() === token.toLowerCase());
        return key !== undefined ? variables[key] : match;
    });
}
//# sourceMappingURL=output-path.js.map