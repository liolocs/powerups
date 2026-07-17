export default ({ name }: Record<string, string>) => {
  const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return `import ${camel} from "../private/commands/${name}/index.js";

export default ${camel};
`;
};