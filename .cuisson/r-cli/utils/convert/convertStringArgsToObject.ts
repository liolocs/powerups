export default function convertStringArgsToObject(args: string[]) {
  // args expected to be in the form of ["--key1", "value1", "--key2", "value2"]
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    result[args[i].replace(/^--/, "")] = args[i + 1];
  }
  return result;
}