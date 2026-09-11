import { type Command } from "@liolocs/program";
import build from "./build.js";
import create from "./create.js";
import harness from "./harness.js";
import install from "./install.js";
import uninstall from "./uninstall.js";
import use from "./use.js";
import template from "./template.js";
import preview from "./preview.js";

const commands: Command<any>[] = [
  build,
  create,
  harness,
  install,
  uninstall,
  use,
  template,
  preview,
];
export default commands;