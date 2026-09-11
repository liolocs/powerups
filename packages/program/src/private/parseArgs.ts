export default function parseArgs(args: string[]) {
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

    flags.push({ flag: arg, value: undefined });
  }

  return { flags, commands };
}