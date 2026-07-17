import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import {
  detectPackageManager,
  applyDependencies,
  collectDependencies,
  type PackageDependencyGroup,
} from "#utils/dependencies";
import captureStdout from "#test-utils/capture-stdout";
import { MAIN_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

test.group("detectPackageManager", () => {
  test.case("should detect pnpm from pnpm-lock.yaml", async assert => {
    await reset();
    await testRoot.append("/pnpm-lock.yaml").write("");
    const pm = await detectPackageManager(testRoot);
    assert(pm?.manager).equals("pnpm");
    assert(pm?.command).equals("pnpm install");
    await testRoot.remove();
  });

  test.case("should detect npm from package-lock.json", async assert => {
    await reset();
    await testRoot.append("/package-lock.json").write("");
    const pm = await detectPackageManager(testRoot);
    assert(pm?.manager).equals("npm");
    assert(pm?.command).equals("npm install");
    await testRoot.remove();
  });

  test.case("should detect yarn from yarn.lock", async assert => {
    await reset();
    await testRoot.append("/yarn.lock").write("");
    const pm = await detectPackageManager(testRoot);
    assert(pm?.manager).equals("yarn");
    assert(pm?.command).equals("yarn install");
    await testRoot.remove();
  });

  test.case("should detect bun from bun.lockb", async assert => {
    await reset();
    await testRoot.append("/bun.lockb").write("");
    const pm = await detectPackageManager(testRoot);
    assert(pm?.manager).equals("bun");
    assert(pm?.command).equals("bun install");
    await testRoot.remove();
  });

  test.case("should detect bun from bun.lock", async assert => {
    await reset();
    await testRoot.append("/bun.lock").write("");
    const pm = await detectPackageManager(testRoot);
    assert(pm?.manager).equals("bun");
    assert(pm?.command).equals("bun install");
    await testRoot.remove();
  });

  test.case("should return null when no lock file found", async assert => {
    await reset();
    const pm = await detectPackageManager(testRoot);
    assert(pm).null();
    await testRoot.remove();
  });

  test.case("should prioritize pnpm over npm", async assert => {
    await reset();
    await testRoot.append("/pnpm-lock.yaml").write("");
    await testRoot.append("/package-lock.json").write("");
    const pm = await detectPackageManager(testRoot);
    assert(pm?.manager).equals("pnpm");
    await testRoot.remove();
  });
});

test.group("applyDependencies dry-run", () => {
  test.case("should print deps and install command without writing", async assert => {
    await reset();
    await testRoot.append("/package.json").write(JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: { "existing-pkg": "^1.0.0" },
    }));
    await testRoot.append("/pnpm-lock.yaml").write("");

    const deps: PackageDependencyGroup[] = [
      { dependencies: ["new-pkg@^2.0.0"] },
    ];

    const output = await captureStdout(async () => {
      await applyDependencies({
        projectRoot: testRoot,
        packageDependencies: deps,
        isDryRun: true,
      });
    });

    assert(output.includes("new-pkg@^2.0.0")).true();
    assert(output.includes("pnpm install")).true();

    const pkg = JSON.parse(await testRoot.append("/package.json").text());
    assert(pkg.dependencies["new-pkg"]).undefined();

    await testRoot.remove();
  });

  test.case("should print target path for monorepo deps", async assert => {
    await reset();
    await fs.create(testRoot.append("/packages/web"));
    await testRoot.append("/packages/web/package.json").write(JSON.stringify({
      name: "web",
      version: "1.0.0",
    }));
    await testRoot.append("/pnpm-lock.yaml").write("");

    const deps: PackageDependencyGroup[] = [
      { target: "packages/web", dependencies: ["react@^18.0.0"] },
    ];

    const output = await captureStdout(async () => {
      await applyDependencies({
        projectRoot: testRoot,
        packageDependencies: deps,
        isDryRun: true,
      });
    });

    assert(output.includes("packages/web")).true();
    assert(output.includes("react@^18.0.0")).true();

    await testRoot.remove();
  });
});

test.group("applyDependencies real run", () => {
  test.case("should write new dependencies to package.json", async assert => {
    await reset();
    await testRoot.append("/package.json").write(JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: { "existing-pkg": "^1.0.0" },
    }));

    const deps: PackageDependencyGroup[] = [
      { dependencies: ["new-pkg@^2.0.0"] },
    ];

    await applyDependencies({
      projectRoot: testRoot,
      packageDependencies: deps,
      isDryRun: false,
    });

    const pkg = JSON.parse(await testRoot.append("/package.json").text());
    assert(pkg.dependencies["existing-pkg"]).equals("^1.0.0");
    assert(pkg.dependencies["new-pkg"]).equals("^2.0.0");

    await testRoot.remove();
  });

  test.case("should write devDependencies to package.json", async assert => {
    await reset();
    await testRoot.append("/package.json").write(JSON.stringify({
      name: "test-project",
      version: "1.0.0",
    }));

    const deps: PackageDependencyGroup[] = [
      { devDependencies: ["typescript@^5.0.0", "eslint@^9.0.0"] },
    ];

    await applyDependencies({
      projectRoot: testRoot,
      packageDependencies: deps,
      isDryRun: false,
    });

    const pkg = JSON.parse(await testRoot.append("/package.json").text());
    assert(pkg.devDependencies["typescript"]).equals("^5.0.0");
    assert(pkg.devDependencies["eslint"]).equals("^9.0.0");

    await testRoot.remove();
  });

  test.case("should skip existing dep with same version silently", async assert => {
    await reset();
    await testRoot.append("/package.json").write(JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: { "existing-pkg": "^1.0.0" },
    }));

    const deps: PackageDependencyGroup[] = [
      { dependencies: ["existing-pkg@^1.0.0", "new-pkg@^2.0.0"] },
    ];

    const output = await captureStdout(async () => {
      await applyDependencies({
        projectRoot: testRoot,
        packageDependencies: deps,
        isDryRun: false,
      });
    });

    assert(output.includes("existing-pkg already in")).false();
    const pkg = JSON.parse(await testRoot.append("/package.json").text());
    assert(pkg.dependencies["new-pkg"]).equals("^2.0.0");

    await testRoot.remove();
  });

  test.case("should warn when skipping existing dep with different version", async assert => {
    await reset();
    await testRoot.append("/package.json").write(JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: { "existing-pkg": "^1.0.0" },
    }));

    const deps: PackageDependencyGroup[] = [
      { dependencies: ["existing-pkg@^2.0.0"] },
    ];

    const output = await captureStdout(async () => {
      await applyDependencies({
        projectRoot: testRoot,
        packageDependencies: deps,
        isDryRun: false,
      });
    });

    assert(output.includes("existing-pkg already in")).true();
    assert(output.includes("^2.0.0")).true();

    const pkg = JSON.parse(await testRoot.append("/package.json").text());
    assert(pkg.dependencies["existing-pkg"]).equals("^1.0.0");

    await testRoot.remove();
  });

  test.case("should write to target package.json in monorepo", async assert => {
    await reset();
    await fs.create(testRoot.append("/packages/web"));
    await testRoot.append("/packages/web/package.json").write(JSON.stringify({
      name: "web",
      version: "1.0.0",
    }));

    const deps: PackageDependencyGroup[] = [
      { target: "packages/web", dependencies: ["react@^18.0.0"] },
    ];

    await applyDependencies({
      projectRoot: testRoot,
      packageDependencies: deps,
      isDryRun: false,
    });

    const pkg = JSON.parse(await testRoot.append("/packages/web/package.json").text());
    assert(pkg.dependencies["react"]).equals("^18.0.0");

    assert(await fs.exists(testRoot.append("/package.json"))).false();

    await testRoot.remove();
  });

  test.case("should warn and skip when target package.json not found", async assert => {
    await reset();

    const deps: PackageDependencyGroup[] = [
      { target: "nonexistent", dependencies: ["some-pkg@^1.0.0"] },
    ];

    const output = await captureStdout(async () => {
      await applyDependencies({
        projectRoot: testRoot,
        packageDependencies: deps,
        isDryRun: false,
      });
    });

    assert(output.includes("not found")).true();
    assert(output.includes("nonexistent")).true();

    await testRoot.remove();
  });

  test.case("should handle multiple groups targeting different packages", async assert => {
    await reset();
    await fs.create(testRoot.append("/packages/web"));
    await fs.create(testRoot.append("/packages/api"));
    await testRoot.append("/packages/web/package.json").write(JSON.stringify({
      name: "web", version: "1.0.0",
    }));
    await testRoot.append("/packages/api/package.json").write(JSON.stringify({
      name: "api", version: "1.0.0",
    }));

    const deps: PackageDependencyGroup[] = [
      { target: "packages/web", dependencies: ["react@^18.0.0"] },
      { target: "packages/api", dependencies: ["express@^4.0.0"] },
    ];

    await applyDependencies({
      projectRoot: testRoot,
      packageDependencies: deps,
      isDryRun: false,
    });

    const webPkg = JSON.parse(await testRoot.append("/packages/web/package.json").text());
    const apiPkg = JSON.parse(await testRoot.append("/packages/api/package.json").text());
    assert(webPkg.dependencies["react"]).equals("^18.0.0");
    assert(apiPkg.dependencies["express"]).equals("^4.0.0");

    await testRoot.remove();
  });

  test.case("should dedup when multiple groups target same package", async assert => {
    await reset();
    await testRoot.append("/package.json").write(JSON.stringify({
      name: "test", version: "1.0.0",
    }));

    const deps: PackageDependencyGroup[] = [
      { dependencies: ["shared-pkg@^1.0.0"] },
      { dependencies: ["shared-pkg@^1.0.0", "other-pkg@^2.0.0"] },
    ];

    const output = await captureStdout(async () => {
      await applyDependencies({
        projectRoot: testRoot,
        packageDependencies: deps,
        isDryRun: false,
      });
    });

    const pkg = JSON.parse(await testRoot.append("/package.json").text());
    assert(pkg.dependencies["shared-pkg"]).equals("^1.0.0");
    assert(pkg.dependencies["other-pkg"]).equals("^2.0.0");

    await testRoot.remove();
  });

  test.case("should do nothing when packageDependencies is empty", async assert => {
    await reset();
    await testRoot.append("/package.json").write(JSON.stringify({
      name: "test", version: "1.0.0",
    }));

    await applyDependencies({
      projectRoot: testRoot,
      packageDependencies: [],
      isDryRun: false,
    });

    const pkg = JSON.parse(await testRoot.append("/package.json").text());
    assert(pkg.dependencies).undefined();

    await testRoot.remove();
  });
});

test.group("collectDependencies", () => {
  test.case("should collect deps from parent only", async assert => {
    await reset();
    const mainFolder = testRoot.append(`/.${MAIN_FOLDER}`);
    const templateFolder = mainFolder.append("/output/template/parent");
    await fs.create(templateFolder);
    await templateFolder.append("/instructions.json").writeJSON({
      name: "parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      packageDependencies: [{ dependencies: ["parent-dep@^1.0.0"] }],
      output: { create: [], modify: [] },
    });

    const deps = await collectDependencies({ outputName: "parent", outputsFolder: mainFolder.append("/output/template") });
    assert(deps.length).equals(1);
    assert(deps[0].dependencies![0]).equals("parent-dep@^1.0.0");

    await testRoot.remove();
  });

  test.case("should collect deps from parent and subtemplates", async assert => {
    await reset();
    const mainFolder = testRoot.append(`/.${MAIN_FOLDER}`);
    const templateFolder = mainFolder.append("/output/template");
    const parentFolder = templateFolder.append("/parent");
    const childFolder = templateFolder.append("/child");
    await fs.create(parentFolder);
    await fs.create(childFolder);

    await parentFolder.append("/instructions.json").writeJSON({
      name: "parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      packageDependencies: [{ dependencies: ["parent-dep@^1.0.0"] }],
      output: { create: [], modify: [] },
      includes: [{ name: "child", variables: {} }],
    });
    await childFolder.append("/instructions.json").writeJSON({
      name: "child",
      description: "test description",
      variables: { required: [] },
      intent: [],
      packageDependencies: [{ dependencies: ["child-dep@^2.0.0"] }],
      output: { create: [], modify: [] },
    });

    const deps = await collectDependencies({ outputName: "parent", outputsFolder: templateFolder });
    assert(deps.length).equals(2);
    assert(deps[0].dependencies![0]).equals("parent-dep@^1.0.0");
    assert(deps[1].dependencies![0]).equals("child-dep@^2.0.0");

    await testRoot.remove();
  });

  test.case("should return empty array when no deps declared", async assert => {
    await reset();
    const mainFolder = testRoot.append(`/.${MAIN_FOLDER}`);
    const templateFolder = mainFolder.append("/output/template/nodeps");
    await fs.create(templateFolder);
    await templateFolder.append("/instructions.json").writeJSON({
      name: "nodeps",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
    });

    const deps = await collectDependencies({ outputName: "nodeps", outputsFolder: mainFolder.append("/output/template") });
    assert(deps.length).equals(0);

    await testRoot.remove();
  });
});