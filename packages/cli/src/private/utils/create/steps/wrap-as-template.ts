/**
 * Wrap file content in a TypeScript template that exports a default function
 * returning the content as a string. Uses JSON.stringify for safe escaping.
 */
export function wrapAsTemplate(content: string): string {
  return `export default function(_variables: Record<string, string>): string {\n  return ${JSON.stringify(content)};\n}\n`;
}
