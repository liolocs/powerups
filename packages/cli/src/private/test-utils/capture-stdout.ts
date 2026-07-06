// `cli.print` writes to `process.stdout` (via @rcompat/io), not `console.log`,
// so we capture stdout by stubbing `process.stdout.write`. The accumulator is
// held in a mutable object so the stub closure can update it across calls.

export default async function captureStdout(
  fn: () => Promise<unknown>,
): Promise<string> {
  const buffer = { value: "" };
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: unknown) => {
    buffer.value += typeof chunk === "string" ? chunk : String(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    await fn();
  } finally {
    process.stdout.write = original;
  }
  return buffer.value;
}

// Like captureStdout, but swallows a thrown error so the caller can assert on
// both the captured output and the error (e.g. commands that print diagnostics
// before throwing a coded error).
export async function captureStdoutOrError(
  fn: () => Promise<unknown>,
): Promise<{ output: string; error: unknown }> {
  const buffer = { value: "" };
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: unknown) => {
    buffer.value += typeof chunk === "string" ? chunk : String(chunk);
    return true;
  }) as typeof process.stdout.write;
  let error: unknown;
  try {
    await fn();
  } catch (error_) {
    error = error_;
  } finally {
    process.stdout.write = original;
  }
  return { output: buffer.value, error };
}