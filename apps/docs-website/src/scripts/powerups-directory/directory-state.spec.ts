import test from "@rcompat/test";
import {
  DEFAULT_DIRECTORY_STATE,
  PAGE_SIZE,
  filterPowerups,
  paginatePowerups,
  pagerPageNumbers,
  sortPowerups,
} from "./directory-state.ts";
import type { PowerupSummary } from "./fetch-powerups.ts";

function makePowerup({ name, monthlyDownloads = 0, publishedAt = "2026-01-01T00:00:00.000Z", description = "", keywords = [] }: {
  name: string;
  monthlyDownloads?: number;
  publishedAt?: string;
  description?: string;
  keywords?: string[];
}): PowerupSummary {
  return {
    name,
    description,
    version: "1.0.0",
    publishedAt,
    updatedAt: publishedAt,
    monthlyDownloads,
    publisherUsername: "",
    npmUrl: "",
    repositoryUrl: null,
    keywords,
  };
}

test.case("filters by name, description, and keywords case-insensitively", async assert => {
  const powerups = [
    makePowerup({ name: "@acme/tailwind-setup", description: "Sets up Tailwind CSS v4" }),
    makePowerup({ name: "@devtools/commit-lint", description: "Enforces conventional commits" }),
    makePowerup({ name: "@oss/readme-gen", keywords: ["readme", "docs"] }),
  ];

  assert(filterPowerups({ powerups, query: "TAILWIND" }).length).equals(1);
  assert(filterPowerups({ powerups, query: "conventional" })[0]?.name).equals("@devtools/commit-lint");
  assert(filterPowerups({ powerups, query: "readme" }).length).equals(1);
  assert(filterPowerups({ powerups, query: "" }).length).equals(3);
  assert(filterPowerups({ powerups, query: "   " }).length).equals(3);
  assert(filterPowerups({ powerups, query: "nothing-matches-this" }).length).equals(0);
});

test.case("sorts by monthly downloads descending with a name tie-break", async assert => {
  const powerups = [
    makePowerup({ name: "@b/pkg", monthlyDownloads: 100 }),
    makePowerup({ name: "@a/pkg", monthlyDownloads: 500 }),
    makePowerup({ name: "@a/aaa", monthlyDownloads: 500 }),
  ];

  const names = sortPowerups({ powerups, sort: "most-downloads" }).map((powerup) => powerup.name).join(",");

  assert(names).equals("@a/aaa,@a/pkg,@b/pkg");
});

test.case("sorts by publish date descending", async assert => {
  const powerups = [
    makePowerup({ name: "@old/pkg", publishedAt: "2026-01-01T00:00:00.000Z" }),
    makePowerup({ name: "@new/pkg", publishedAt: "2026-08-24T13:32:58.976Z" }),
    makePowerup({ name: "@mid/pkg", publishedAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const names = sortPowerups({ powerups, sort: "recently-published" }).map((powerup) => powerup.name).join(",");

  assert(names).equals("@new/pkg,@mid/pkg,@old/pkg");
});

test.case("sorts names ascending and descending", async assert => {
  const powerups = [
    makePowerup({ name: "@b/b" }),
    makePowerup({ name: "@a/z" }),
    makePowerup({ name: "@a/a" }),
  ];

  const ascending = sortPowerups({ powerups, sort: "name-asc" }).map((powerup) => powerup.name).join(",");
  const descending = sortPowerups({ powerups, sort: "name-desc" }).map((powerup) => powerup.name).join(",");

  assert(ascending).equals("@a/a,@a/z,@b/b");
  assert(descending).equals("@b/b,@a/z,@a/a");
});

test.case("paginates with a clamped page and correct range indexes", async assert => {
  const powerups = Array.from({ length: 120 }, (_, index) => makePowerup({ name: "@pkg/" + String(index).padStart(3, "0") }));

  const page1 = paginatePowerups({ powerups, page: 1, pageSize: PAGE_SIZE });
  assert(page1.total).equals(120);
  assert(page1.totalPages).equals(3);
  assert(page1.firstIndex).equals(1);
  assert(page1.lastIndex).equals(50);
  assert(page1.slice.length).equals(50);

  const page3 = paginatePowerups({ powerups, page: 3, pageSize: PAGE_SIZE });
  assert(page3.firstIndex).equals(101);
  assert(page3.lastIndex).equals(120);
  assert(page3.slice.length).equals(20);

  const clamped = paginatePowerups({ powerups, page: 99, pageSize: PAGE_SIZE });
  assert(clamped.firstIndex).equals(101);
  assert(clamped.slice.length).equals(20);
});

test.case("handles an empty list", async assert => {
  const empty = paginatePowerups({ powerups: [], page: 1, pageSize: PAGE_SIZE });

  assert(empty.total).equals(0);
  assert(empty.totalPages).equals(1);
  assert(empty.firstIndex).equals(0);
  assert(empty.lastIndex).equals(0);
  assert(empty.slice.length).equals(0);
});

test.case("shows every page number when the list is short", async assert => {
  const entries = pagerPageNumbers({ page: 2, totalPages: 5 });

  assert(JSON.stringify(entries)).equals(JSON.stringify([1, 2, 3, 4, 5]));
});

test.case("windows long page lists with gaps", async assert => {
  const first = pagerPageNumbers({ page: 1, totalPages: 61 });
  const middle = pagerPageNumbers({ page: 30, totalPages: 61 });
  const last = pagerPageNumbers({ page: 61, totalPages: 61 });

  assert(JSON.stringify(first)).equals(JSON.stringify([1, 2, 3, "gap", 61]));
  assert(JSON.stringify(middle)).equals(JSON.stringify([1, "gap", 29, 30, 31, "gap", 61]));
  assert(JSON.stringify(last)).equals(JSON.stringify([1, "gap", 59, 60, 61]));
});

test.case("exposes the documented defaults", async assert => {
  assert(DEFAULT_DIRECTORY_STATE.query).equals("");
  assert(DEFAULT_DIRECTORY_STATE.sort).equals("most-downloads");
  assert(DEFAULT_DIRECTORY_STATE.page).equals(1);
  assert(PAGE_SIZE).equals(50);
});
