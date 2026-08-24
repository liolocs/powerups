import { INSTALLED_FOLDER } from "#constants";

export interface ParsedSource {
  type: "npm" | "git" | "internal";
  configEntry: string;
  storePath: string;
  cloneUrl?: string;
}

export default function parseSource(source: string): ParsedSource {
  if (source.startsWith("npm:")) {
    const packageName = source.slice(4);
    return {
      type: "npm",
      configEntry: source,
      storePath: `${INSTALLED_FOLDER.npm}/node_modules/${packageName}`,
    };
  }

  if (source.startsWith("git:")) {
    const rest = source.slice(4);
    return {
      type: "git",
      configEntry: source,
      storePath: `${INSTALLED_FOLDER.git}/${rest}`,
      cloneUrl: `https://${rest}`,
    };
  }

  if (source.startsWith("git@")) {
    const atIndex = source.indexOf("@");
    const colonIndex = source.indexOf(":", atIndex);
    const domain = source.slice(atIndex + 1, colonIndex);
    const rest = source.slice(colonIndex + 1);
    const repoPath = rest.endsWith(".git") ? rest.slice(0, -4) : rest;
    return {
      type: "git",
      configEntry: source,
      storePath: `${INSTALLED_FOLDER.git}/${domain}/${repoPath}`,
      cloneUrl: source,
    };
  }

  if (source.startsWith("https://") || source.startsWith("http://")) {
    const url = source.endsWith(".git") ? source.slice(0, -4) : source;
    const urlObj = new URL(url);
    const parts = urlObj.pathname.slice(1).split("/").filter(Boolean);
    const domain = urlObj.hostname;
    const owner = parts[0] ?? "";
    const repo = parts[1] ?? "";
    return {
      type: "git",
      configEntry: source,
      storePath: `${INSTALLED_FOLDER.git}/${domain}/${owner}/${repo}`,
      cloneUrl: source,
    };
  }

  const internalName = source.startsWith("internal:")
    ? source.slice("internal:".length)
    : source;
  return {
    type: "internal",
    configEntry: source,
    storePath: `${INSTALLED_FOLDER.internal}/${internalName}`,
  };
}