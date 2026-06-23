import fs from "@rcompat/fs";
import fileExists from "./fileExists";

export default async function createFile({ pathToFile, content }: { pathToFile: string, content: string }) {
  if (await fileExists(pathToFile)) {
    console.log(`[-] File ${pathToFile} already exists`);
    return;
  }
  await fs.ref(pathToFile).write(content);
  console.log(`[+] Created file ${pathToFile}`);
}