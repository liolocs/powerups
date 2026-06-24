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
  action: (flags: Record<string, unknown>) => void;
}

export default class Command {
  name: string;
  description: string;
  flags: Flag[];
  subcommands: CommandType[];
  action: (flags: Record<string, unknown>) => void;

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
    action: (flags: Record<string, unknown>) => void;
  }) {
    this.name = name;
    this.description = description;
    this.flags = flags;
    this.subcommands = subcommands;
    this.action = action;
  }

  run(): void {
    return this.action({});
  }
}