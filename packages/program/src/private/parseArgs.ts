import type Command from "#Command";

export type FlagTypes = Record<string, "boolean" | "string">;

export function collectFlagTypes({
  commands,
  extraFlags = {},
}: {
  commands: Command<any>[];
  extraFlags?: FlagTypes;
}): FlagTypes {
  const flagTypes: FlagTypes = { ...extraFlags };

  function record({ key, type }: { key: string; type: "boolean" | "string" }) {
    if (type === "boolean" && flagTypes[key] === "string") {
      return;
    }
    flagTypes[key] = type;
  }

  function collect(command: Command<any>) {
    for (const flag of command.flags) {
      const type = flag.type === "boolean" ? "boolean" : "string";
      record({ key: flag.long, type });
      record({ key: flag.short, type });
    }
    for (const sub of command.subcommands.values()) {
      collect(sub);
    }
  }

  for (const command of commands) {
    collect(command);
  }

  return flagTypes;
}

export default function parseArgs(args: string[], flagTypes: FlagTypes = {}) {
  const flags: { flag: string; value?: string }[] = [];
  const commands: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (!arg.startsWith("-")) {
      commands.push(arg);
      continue;
    }

    const separatorIndex = arg.indexOf("=");

    if (separatorIndex !== -1) {
      const name = arg.slice(0, separatorIndex);
      const value = arg.slice(separatorIndex + 1);
      flags.push({ flag: name, value });
      continue;
    }

    const key = arg.replace(/^-+/, "");
    const type = key === "" ? "boolean" : flagTypes[key] ?? "string";

    const next = args[index + 1];
    const hasSpaceValue = type === "string"
      && typeof next !== "undefined"
      && !next.startsWith("-");

    if (hasSpaceValue) {
      flags.push({ flag: arg, value: next });
      index++;
      continue;
    }

    flags.push({ flag: arg, value: undefined });
  }

  return { flags, commands };
}
