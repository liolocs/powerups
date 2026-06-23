import fs from "@rcompat/fs";

export default async function importFile(pathToFile: string) {
  return await fs.ref(pathToFile).import()
}