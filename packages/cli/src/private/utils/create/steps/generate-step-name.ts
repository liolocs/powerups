export function generateStepName({
  prefix,
  filePath,
  existingNames,
}: {
  prefix: "create" | "modify" | "delete";
  filePath: string;
  existingNames: Set<string>;
}): string {
  const lastDotIndex = filePath.lastIndexOf(".");
  const lastSlashIndex = filePath.lastIndexOf("/");
  const pathNoExt = lastDotIndex > lastSlashIndex
    ? filePath.substring(0, lastDotIndex)
    : filePath;
  const baseName = `${prefix}-${pathNoExt.replace(/\//g, "-")}`;

  if (!existingNames.has(baseName)) {
    existingNames.add(baseName);
    return baseName;
  }

  let counter = 2;

  while (existingNames.has(`${baseName}-${counter}`)) {
    counter++;
  }

  const finalName = `${baseName}-${counter}`;

  existingNames.add(finalName);

  return finalName;
}