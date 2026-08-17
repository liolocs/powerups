function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export default function(variables: Record<string, string>): string {
  const { parentCommand, errorCases } = variables;
  const _parentVar = toCamelCase(parentCommand);

  const parsedErrorCases: Array<{ name: string; text: string }> =
    JSON.parse(errorCases || "[]");

  // If no error cases, return empty modifications (no changes to file)
  if (parsedErrorCases.length === 0) {
    return JSON.stringify([], null, 2);
  }

  // Generate new error case entries to insert before the closing });
  const newErrors = parsedErrorCases.map(e => {
    const escapedText = e.text
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
    return `  ${e.name}: () => {
    const errorText = "${escapedText}";
    return t\`\${errorBGText}\${errorText}\`;
  },`;
  }).join("\n");

  const modifications = [
    // Insert new error cases before the closing }); of error.coded({...})
    {
      where: { before: "});" },
      content: newErrors + "\n",
    },
  ];

  return JSON.stringify(modifications, null, 2);
}