import { type Command } from "@liolocs/program";
import build from "./build.js";
import create from "./create.js";
import install from "./install.js";
import uninstall from "./uninstall.js";
import use from "./use.js";

const commands: Command<any>[] = [
  build,
  create,
  install,
  uninstall,
  use,
];
export default commands;