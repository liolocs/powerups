import repository from "@rcompat/test/repository";
import fs from "@rcompat/fs";
import path from "node:path";

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Usage: bun run run-single-test.ts <spec-file-path>");
  process.exit(1);
}

const filePath = path.resolve(fileArg);
const file = fs.ref(filePath);

// Set up the suite (what proby does before importing the spec file)
repository.suite(file);
const suite = repository.next().next().value;

// Import the spec file — this registers all test.case() calls
await file.import();

// Run the suite
let passed = 0;
let failed = 0;
const iter = suite.run()[Symbol.asyncIterator]();

while (true) {
  const { done, value } = await iter.next();
  if (done || !value) break;

  const { test, duration } = value;
  const testFailed = test.results.some((r: { passed: boolean }) => !r.passed);

  if (testFailed) {
    failed++;
    console.log(`  ✗ ${test.name} [${duration.toFixed(2)}ms]`);
    for (const r of test.results) {
      if (!r.passed) {
        console.log(`    Expected: ${r.expected}`);
        console.log(`    Actual:   ${r.actual}`);
      }
    }
  } else {
    passed++;
    console.log(`  ✓ ${test.name} [${duration.toFixed(2)}ms]`);
  }
}

console.log(`\n${passed} pass, ${failed} fail`);
process.exit(failed > 0 ? 1 : 0);