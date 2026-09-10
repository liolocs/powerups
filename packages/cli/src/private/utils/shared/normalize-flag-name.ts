export default function normalizeFlagName(flag: string): string {
  const stripped = flag.replace(/^--?/, "");
  const parts = stripped.split("-");

  return parts[0] +
    parts.slice(1)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
}
