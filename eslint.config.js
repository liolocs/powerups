import eslint from "apekit/lint";

export default [
  ...eslint(import.meta.dirname),
  { ignores: ["packages/cli/scripts/**", "packages/cli/tsup.config.ts"] },
];