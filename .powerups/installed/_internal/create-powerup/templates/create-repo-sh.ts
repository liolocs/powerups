export default function(variables: Record<string, string>): string {
  const { name, description } = variables;

  return `gh repo create ${name} --public --source=. --remote=origin && git push -u origin master`;
}