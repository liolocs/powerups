import { type Command } from "@liolocs/program";
import build from "./author.js";
import harness from "./harness.js";
import install from "./install.js";
import uninstall from "./uninstall.js";
import use from "./use.js";

const commands: Command<any>[] = [
  build,
  harness,
  install,
  uninstall,
  use,
];
export default commands;