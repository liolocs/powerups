import test from "@rcompat/test";
import { normalizeSearchObject, type NpmSearchObject } from "./fetch-powerups.ts";

const fullSearchObject: NpmSearchObject = {
  downloads: { monthly: 257, weekly: 61 },
  updated: "2026-08-31T13:36:10.276Z",
  package: {
    name: "@liolocs/powerup-hello-world",
    version: "1.1.0",
    description: "A powerup useful for testing",
    keywords: ["powerups-package"],
    date: "2026-08-24T13:32:58.976Z",
    publisher: { username: "liolocs" },
    links: {
      npm: "https://www.npmjs.com/package/@liolocs/powerup-hello-world",
      repository: "git+https://github.com/liolocs/powerup-hello-world.git",
    },
  },
};

test.case("normalizes a complete npm search object", async assert => {
  const summary = normalizeSearchObject({ searchObject: fullSearchObject });

  assert(summary.name).equals("@liolocs/powerup-hello-world");
  assert(summary.description).equals("A powerup useful for testing");
  assert(summary.version).equals("1.1.0");
  assert(summary.publishedAt).equals("2026-08-24T13:32:58.976Z");
  assert(summary.updatedAt).equals("2026-08-31T13:36:10.276Z");
  assert(summary.monthlyDownloads).equals(257);
  assert(summary.publisherUsername).equals("liolocs");
  assert(summary.npmUrl).equals("https://www.npmjs.com/package/@liolocs/powerup-hello-world");
  assert(summary.repositoryUrl).equals("git+https://github.com/liolocs/powerup-hello-world.git");
  assert(summary.keywords.length).equals(1);
});

test.case("fills defensive defaults when fields are missing", async assert => {
  const summary = normalizeSearchObject({ searchObject: {} });

  assert(summary.name).equals("");
  assert(summary.description).equals("");
  assert(summary.version).equals("");
  assert(summary.publishedAt).equals("");
  assert(summary.updatedAt).equals("");
  assert(summary.monthlyDownloads).equals(0);
  assert(summary.publisherUsername).equals("");
  assert(summary.npmUrl).equals("");
  assert(summary.repositoryUrl === null).equals(true);
  assert(summary.keywords.length).equals(0);
});
