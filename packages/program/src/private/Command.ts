export interface Flag {
  long: string;
  short: string;
  description: string;
}

export interface CommandType {
  name: string;
  description: string;
  flags: Flag[];
  subcommands: CommandType[];
  action: (flags: Flag[], args?: string[]) => void;
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

  run(args?: string[]): void {
    return this.action(this.flags, args);
  }
}