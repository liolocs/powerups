import { type Command } from "@liolocs/program";
import add from "./add.js";
import build from "./build.js";
import create from "./create.js";
import doctor from "./doctor.js";
import find from "./find.js";
import install from "./install.js";
import list from "./list.js";
import metrics from "./metrics.js";
import pack from "./pack.js";
import project from "./project.js";
import update from "./update.js";
import use from "./use.js";

const commands: Command<any>[] = [
  add,
  build,
  create,
  doctor,
  find,
  install,
  list,
  metrics,
  pack,
  project,
  update,
  use,
];
export default commands;