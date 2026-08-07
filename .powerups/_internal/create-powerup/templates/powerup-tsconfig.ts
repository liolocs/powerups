export default function(): string {
  return JSON.stringify({
    compilerOptions: {
      allowJs: true,
      target: "esnext",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      erasableSyntaxOnly: true,
      types: ["node"],
      allowImportingTsExtensions: true,
      noEmit: true,
    },
    exclude: ["node_modules", "${configDir}/node_modules"],
  }, null, 2) + "\n";
}