export default function navigateJsonPath({
  json,
  path,
}: {
  json: unknown;
  path: string;
}): string {
  const parts = path.split(".");
  let current: unknown = json;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      throw new Error(`JSON path "${path}" not found`);
    }

    current = (current as Record<string, unknown>)[part];
  }

  if (current === undefined || current === null) {
    throw new Error(`JSON path "${path}" not found`);
  }

  return String(current);
}