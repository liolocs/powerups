import command_errors from "#errors/CommandErrors";
import is from "@rcompat/is";

export interface Flag {
  name: string;
  long: string;
  short: string;
  description: string;
  required?: boolean;
}

// Extract flag names as a union of string literals from a tuple of flags
type FlagNames<T extends readonly Flag[]> = T[number]["name"];

// Build a record of { flagName: string } from the flags tuple
type FlagRecord<T extends readonly Flag[]> = {
  [K in FlagNames<T>]: string | undefined;
};

type ActionProps<T extends readonly Flag[]> = FlagNames<T> extends never
  ? (props?: { flags: FlagRecord<T>; subcommands?: string[]; rawFlags?: { flag: string; value: string }[] }) =>
      any | Promise<any>
  : (props: { flags: FlagRecord<T>; subcommands?: string[]; rawFlags?: { flag: string; value: string }[] }) =>
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
  }): Promise<void> {
    // --help short-circuits everything, always
    if (args?.flags.some(f => f.flag === "--help" || f.flag === "-h")
      === true) {
      console.log(this.buildHelp());
      return;
    }

    // Delegate to subcommand if one is provided and matches
    if (is.truthy(args?.subcommands.length)) {
      const [head, ...tail] = args!.subcommands;
      const sub = this.subcommands.get(head);

      if (is.defined(sub)) {
        const flags = is.defined(args!.flags) ? args!.flags : [];
        return sub!.run({ subcommands: tail, flags: flags });
      }

      // No matching subcommand found
      if (this.subcommands.size > 0) {
        // Has subcommands but the first positional arg doesn't match any
        throw command_errors.invalid_subcommand(head, this.name);
      }

      // No subcommands at all — fall through to action with positional args
    }

    // No subcommand — check if one is required
    if (this.subcommands.size > 0 && this.requiresSubcommand === true) {
      throw command_errors.missing_required_subcommand(this.name);
    }

    // No args at all — run bare action
    if (!is.defined(args)) {
      // @ts-expect-error — flags are optional
      return this.action({ flags: {}, subcommands: [], rawFlags: [] });
    }

    if (this._hasMissingRequiredFlags(args.flags)) {
      throw command_errors.missing_required_flags(this.name);
    }

    const passedFlags = is.defined(args.flags) ? args.flags : [];
    const matchedFlags = this._getMatchedFlags({ passedFlags });
    const subcommands = is.defined(args.subcommands) ? args.subcommands : [];

    return await this.action({ flags: matchedFlags, subcommands, rawFlags: passedFlags });
  }

  public buildHelp(): string {
    const lines: string[] = [
      `${this.name} — ${this.description}`,
      "",
    ];

    if (this.flags.length > 0) {
      lines.push("Flags:");

      for (const flag of this.flags) {
        const required = flag.required === true ? " (required)" : "";
        const short = is.defined(flag.short) ? `-${flag.short}` : "";
        const long = is.defined(flag.long) ? `--${flag.long}` : "";
        const shortAndLong = [short, long].filter(Boolean).join(", ");
        const description = flag.description + required;

        lines.push(`  ${shortAndLong.padEnd(20)} ${description}`);
        lines.push("\n");
      }

      lines.push("");
    }

    if (this.subcommands.size > 0) {
      lines.push("Subcommands:");

      for (const [name, sub] of this.subcommands) {
        lines.push(`  ${name}  ${sub.description}`);
      }
    }

    lines.push(`  ${"--h, -help".padEnd(20)} Show this help message`);

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