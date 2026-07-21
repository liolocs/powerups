function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export default function(variables: Record<string, string>): string {
  const { commandName } = variables;
  const varName = toCamelCase(commandName);

  return `import ${varName} from "../private/commands/${commandName}/index.js";

export default ${varName};
`;
}