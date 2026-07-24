import command_errors from "#errors/CommandErrors";
import cli from "@rcompat/cli";
import is from "@rcompat/is";

export interface Flag {
  name: string;
  long: string;
  short: string;
  description: string;
  required?: boolean;
}

type FlagNames<T extends readonly Flag[]> = T[number]["name"];

type FlagRecord<T extends readonly Flag[]> = {
  [K in FlagNames<T>]: string | undefined;
};

type ActionProps<T extends readonly Flag[]> = FlagNames<T> extends never
  ? (props?: { flags: FlagRecord<T>; subcommands?: string[]; rawFlags?: { flag: string; value: string }[]; context?: { root?: any; homeDir?: string; globalRoot?: string } }) =>
      any | Promise<any>
  : (props: { flags: FlagRecord<T>; subcommands?: string[]; rawFlags?: { flag: string; value: string }[]; context?: { root?: any; homeDir?: string; globalRoot?: string } }) =>
      any | Promise<any>;

export default class Command<T extends readonly Flag[]> {
  name: string;
  description: string;
  flags: T;
  subcommands: Map<string, Command<any>>;
  requiresSubcommand?: boolean;
  action: ActionProps<T>;

  constructor({
    name,
    description,
    flags,
    subcommands,
    action,
    requiresSubcommand,
  }: {
    name: string;
    description: string;
    flags: T;
    subcommands: Command<any>[];
    action: ActionProps<T>;
    requiresSubcommand?: boolean;
  }) {
    this.name = name;
    this.description = description;
    this.flags = flags;
    this.subcommands = new Map(subcommands.map(sub => [sub.name, sub]));
    this.requiresSubcommand = requiresSubcommand ?? false;
    this.action = action;
  }

  async run(args?: {
    subcommands: string[];
    flags: { flag: string; value: string }[];
    context?: { root?: any; homeDir?: string; globalRoot?: string };
  }): Promise<void> {
    // Delegate to a matching subcommand first, so that `<cmd> <sub> --help`
    // reaches the subcommand's own help rather than this command's.
    if (is.truthy(args?.subcommands.length)) {
      const [head, ...tail] = args!.subcommands;
      const sub = this.subcommands.get(head);

      if (is.defined(sub)) {
        const flags = is.defined(args!.flags) ? args!.flags : [];
        return sub!.run({ subcommands: tail, flags: flags });
      }

      if (this.subcommands.size > 0) {
        throw command_errors.invalid_subcommand(head, this.name);
      }

    }

    if (args?.flags.some(f => f.flag === "--help" || f.flag === "-h")
      === true) {
      cli.print(`${this.buildHelp()}\n`);
      return;
    }

    if (this.subcommands.size > 0 && this.requiresSubcommand === true) {
      throw command_errors.missing_required_subcommand(
        this.name,
        [...this.subcommands.values()].map(sub => ({
          name: sub.name,
          description: sub.description,
        })),
      );
    }

    if (!is.defined(args)) {
      // @ts-expect-error — flags are optional
      return this.action({ flags: {}, subcommands: [], rawFlags: [], context: args?.context });
    }

    if (this._hasMissingRequiredFlags(args.flags)) {
      throw command_errors.missing_required_flags(this.name);
    }

    const passedFlags = is.defined(args.flags) ? args.flags : [];
    const matchedFlags = this._getMatchedFlags({ passedFlags });
    const subcommands = is.defined(args.subcommands) ? args.subcommands : [];

    return await this.action({ flags: matchedFlags, subcommands, rawFlags: passedFlags, context: args?.context });
  }

  public buildHelp(): string {
    const lines: string[] = [];

    // Header
    lines.push(`${this.name} — ${this.description}`);
    lines.push("");

    lines.push("USAGE");
    if (this.subcommands.size > 0) {
      lines.push(`  ${this.name} <subcommand> [flags]`);
    } else {
      lines.push(`  ${this.name} [flags]`);
    }
    lines.push("");

    if (this.subcommands.size > 0) {
      lines.push("SUBCOMMANDS");
      const subs = [...this.subcommands.values()];
      const width = Math.max(...subs.map(sub => sub.name.length));
      for (const sub of subs) {
        lines.push(`  ${sub.name.padEnd(width + 2)}${sub.description}`);
      }
      lines.push("");
    }

    // Flags (always includes the implicit help flag)
    const flagEntries: { label: string; desc: string }[] =
      this.flags.map(flag => {
        const short = is.defined(flag.short) ? `-${flag.short}` : "";
        const long = is.defined(flag.long) ? `--${flag.long}` : "";
        const label = [short, long].filter(Boolean).join(", ");
        const required = flag.required === true ? " (required)" : "";
        return { label, desc: `${flag.description}${required}` };
      });
    flagEntries.push({
      label: "-h, --help",
      desc: `Show help for ${this.name}`,
    });

    const flagWidth = Math.max(...flagEntries.map(entry => entry.label.length));
    lines.push("FLAGS");
    for (const entry of flagEntries) {
      lines.push(`  ${entry.label.padEnd(flagWidth + 2)}${entry.desc}`);
    }

    return lines.join("\n");
  }

  private _getMatchedFlags({
    passedFlags,
  }: {
    passedFlags: { flag: string; value: string }[];
  }): FlagRecord<T> {
    const result = {} as FlagRecord<T>;

    for (const flag of this.flags) {
      const matched = passedFlags.find(
        f => f.flag === flag.long || f.flag === flag.short
          || f.flag === `--${flag.long}` || f.flag === `-${flag.short}`,
      );

      (result as Record<string, string | undefined>)[flag.name] =
        matched?.value;
    }

    return result;
  }

  private _hasMissingRequiredFlags(flags: { flag: string; value: string }[]) {
    const hasNoFlagsInCommandSetup =
      flags.length === 0 && this.flags.length === 0;

    if (hasNoFlagsInCommandSetup) {
      return false;
    }

    function matchesFlag(flag: Flag) {
      return flags.find(
        f => f.flag === flag.long || f.flag === flag.short
          || f.flag === `--${flag.long}` || f.flag === `-${flag.short}`,
      );
    }

    const missingFlags = this.flags.filter(flag => {
      if (flag.required === true) {
        return matchesFlag(flag) === undefined;
      }
      return false;
    });

    return missingFlags.length > 0;
  }
}