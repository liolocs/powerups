import runtime from "@rcompat/runtime";
import {difference} from "@rcompat/array";

console.log(runtime.args);
console.log("flags", runtime.flags.all())
console.log("all", Object.keys(runtime.flags.all()));
console.log("difference", difference(runtime.args, Object.keys(runtime.flags.all())));