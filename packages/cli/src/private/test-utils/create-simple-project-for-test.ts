import { PACKAGE_JSON } from "#constants";
import git from "#utils/git";
import { type FileRef } from "@rcompat/fs";

export default async function createSimpleProjectForTest({
  projectName = "new-project",
  testRoot,
}: {
  projectName?: string;
  testRoot: FileRef;
}) {
  const projectDir = testRoot.append(`/${projectName}`);
  await projectDir.create();
  await git.init({ cwd: projectDir });

  const pkgJson = {
    name: projectName,
    version: "1.0.0",
    description: "a test project",
    main: "index.ts",
    scripts: {
      test: "echo \"Error: no test specified\" && exit 1",
    },
    keywords: [],
    author: "",
    license: "ISC",
  };

  await projectDir.append(`/${PACKAGE_JSON}`).writeJSON(pkgJson);

  try {
    await git.commitAll({ cwd: projectDir, message: "initial commit" });
  } catch (e) {
    console.error(e);
  }

  return {
    projectDir,
  }
}