import { FOLDER_FOR_NPM_INSTALLED_PACKAGES, FOLDER_FOR_GIT_INSTALLED_PACKAGES } from "#constants";

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
      storePath: `${FOLDER_FOR_NPM_INSTALLED_PACKAGES}/node_modules/${packageName}`,
    };
  }

  if (source.startsWith("git:")) {
    const rest = source.slice(4);
    return {
      type: "git",
      configEntry: source,
      storePath: `${FOLDER_FOR_GIT_INSTALLED_PACKAGES}/${rest}`,
      cloneUrl: `https://${rest}`,
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
      storePath: `${FOLDER_FOR_GIT_INSTALLED_PACKAGES}/${domain}/${owner}/${repo}`,
      cloneUrl: source,
    };
  }

  return {
    type: "internal",
    configEntry: source,
    storePath: source,
  };
}