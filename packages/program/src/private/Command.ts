import cli from "@rcompat/cli";
import is from "@rcompat/is"

export interface Flag {
  long: string;
  short: string;
  description: string;
  required?: boolean;
}

export interface CommandType {
  name: string;
  description: string;
  flags: Flag[];
  subcommands: CommandType[];
  action: (props?: {flags: Flag[]; subcommands?: string[]}) => void;
}

export default class Command {
  name: string;
  description: string;
  flags: Flag[];
  subcommands: CommandType[];
  action: CommandType["action"];

  constructor({
    name,
    description,
    flags,
    subcommands,
    action,
  }: {
    name: string;
    description: string;
    flags: Flag[];
    subcommands: CommandType[];
    action: CommandType["action"];
  }) {
    this.name = name;
    this.description = description;
    this.flags = flags;
    this.subcommands = subcommands;
    this.action = action;
  }

  run(args?: {
    subcommands: string[],
    flags: { flag: string, value: string }[]
  }): void {
    console.log(args?.flags);
    console.log(this.flags);

    if(is.defined(args) && this._hasMissingRequiredFlags(args.flags) === true) {
      throw new Error(this._showMissingRequiredFlagsError());
    }
    // return this.action({flags, subcommands});
    return this.action();
  }

  private _hasMissingRequiredFlags(flags: { flag: string; value: string }[]) {
    const hasNoFlagsInCommandSetup = flags.length === 0
      && this.flags.length === 0;

    if(hasNoFlagsInCommandSetup) {
      return false;
    }

    function matchesFlag(flag: Flag) {
      return flags.find(f =>
        f.flag === flag.long || f.flag === flag.short,
      );
    }

    const missingFlags = this.flags.filter(flag => {
      if (flag.required === true) {
        if (matchesFlag(flag) === undefined) {
          return true;
        }
        return false;
      }
      return false;
    });

    if (missingFlags.length > 0) {
      return true;
    }

    return false;
  }

  private _showMissingRequiredFlagsError() {
    return cli.bg.red(cli.fg.white(" ERROR ")) +
      "Missing required arguments for the " +
      `${cli.bg.yellow(" " + this.name + " ")} command.\n`;
  }
}