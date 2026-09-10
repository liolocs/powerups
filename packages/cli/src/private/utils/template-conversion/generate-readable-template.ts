export default function generateReadableTemplate({ content }: { content: string }): string {
  const escapedContent = content
    .replace(/\\/g, () => "\\\\")
    .replace(/`/g, () => "\\`")
    .replace(/\$\{/g, () => "\\${");

  return "export default function (_variables: Record<string, string>): string {\n"
    + "  return `" + escapedContent + "`;\n"
    + "}\n";
}