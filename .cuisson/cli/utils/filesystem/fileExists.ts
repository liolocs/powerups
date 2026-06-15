import fs from "@rcompat/fs";

export default async function fileExists(pathToFile: string) {
  return await fs.ref(pathToFile).exists();
}