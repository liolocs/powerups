
// `cli.print` writes to `process.stdout` (via @rcompat/io), not `console.log`,
// so we capture stdout by stubbing `process.stdout.write`.
export default async function captureStdout(
  fn: () => Promise<unknown>,
): Promise<string> {
  let output = "";
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: unknown) => {
    output += typeof chunk === "string" ? chunk : String(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    await fn();
  } finally {
    process.stdout.write = original;
  }
  return output;
}