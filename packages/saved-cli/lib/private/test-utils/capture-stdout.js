// `cli.print` writes to `process.stdout` (via @rcompat/io), not `console.log`,
// so we capture stdout by stubbing `process.stdout.write`.
export default async function captureStdout(fn) {
    let output = "";
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk) => {
        output += typeof chunk === "string" ? chunk : String(chunk);
        return true;
    });
    try {
        await fn();
    }
    finally {
        process.stdout.write = original;
    }
    return output;
}
//# sourceMappingURL=capture-stdout.js.map