import { type Command } from "@pwrp/program";
import add from "./add.js";
import create from "./create.js";
import doctor from "./doctor.js";
import find from "./find.js";
import info from "./info.js";
import install from "./install.js";
import list from "./list.js";
import metrics from "./metrics.js";
import pack from "./pack.js";
import project from "./project.js";
import update from "./update.js";
import use from "./use.js";
import validate from "./validate.js";

const commands: Command<any>[] = [
  add,
  create,
  doctor,
  find,
  info,
  install,
  list,
  metrics,
  pack,
  project,
  update,
  use,
  validate,
];
export default commands;
