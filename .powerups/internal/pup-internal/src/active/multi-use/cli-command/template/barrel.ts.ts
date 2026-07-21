export default function(variables: Record<string, string>): string {
  const { commandName } = variables;

  return `import ${commandName} from "../private/commands/${commandName}/index.js";

export default ${commandName};
`;
}