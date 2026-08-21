export default function wrapAsTemplate(content: string): string {
  return `export default function(_variables: Record<string, string>): string {\n  return ${JSON.stringify(content)};\n}\n`;
}