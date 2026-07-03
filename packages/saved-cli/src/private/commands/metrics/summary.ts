import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";
import metricsErrors from "#errors/metricsErrors";
import { readMetrics, type MetricsEntry } from "#utils/metrics";
import { MAIN_FOLDER } from "#constants";

interface PatternAggregate {
  runs: number;
  characters: number;
}

const summary = new Command({
  name: "summary",
  description: "Show aggregated metrics for all pattern runs",
  flags: [],
  subcommands: [],
  action: async (props) => {
    const root: FileRef = props?.context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    const hasDryFolder = await fs.exists(mainFolder);

    if (!hasDryFolder) {
      throw metricsErrors.dry_folder_not_found();
    }

    const entries: MetricsEntry[] = await readMetrics(root);

    if (entries.length === 0) {
      cli.print("No metrics recorded yet. Run a pattern to start collecting metrics.");
      return;
    }

    // Aggregate by pattern name
    const byPattern = new Map<string, PatternAggregate>();

    for (const entry of entries) {
      const existing = byPattern.get(entry.pattern) ?? { runs: 0, characters: 0 };
      existing.runs += 1;
      existing.characters += entry.characters;
      byPattern.set(entry.pattern, existing);
    }

    // Build rows, sorted by characters descending
    const rows = [...byPattern.entries()]
      .map(([pattern, agg]) => ({
        pattern,
        runs: agg.runs,
        characters: agg.characters,
        estTokens: Math.round(agg.characters / 4),
      }))
      .sort((a, b) => b.characters - a.characters);

    // Compute totals
    const totalRuns = rows.reduce((sum, r) => sum + r.runs, 0);
    const totalCharacters = rows.reduce((sum, r) => sum + r.characters, 0);
    const totalEstTokens = Math.round(totalCharacters / 4);

    // Column definitions
    const headers = ["Pattern", "Runs", "Characters", "Est. Tokens Saved"];

    // Build string rows for width calculation
    const dataRows = rows.map(r => [
      r.pattern,
      r.runs.toLocaleString(),
      r.characters.toLocaleString(),
      `~${r.estTokens.toLocaleString()}`,
    ]);
    const totalRow = [
      "TOTAL",
      totalRuns.toLocaleString(),
      totalCharacters.toLocaleString(),
      `~${totalEstTokens.toLocaleString()}`,
    ];

    // Compute column widths
    const colWidths = headers.map((h, i) =>
      Math.max(
        h.length,
        ...dataRows.map(r => r[i].length),
        totalRow[i].length,
      ),
    );

    // Row formatter: pattern left-aligned, numbers right-aligned
    const formatRow = (pattern: string, runs: string, chars: string, tokens: string) =>
      `${pattern.padEnd(colWidths[0])}   ${runs.padStart(colWidths[1])}   ${chars.padStart(colWidths[2])}   ${tokens.padStart(colWidths[3])}`;

    // Print table
    cli.print(formatRow(headers[0], headers[1], headers[2], headers[3]));
    cli.print(colWidths.map(w => "─".repeat(w)).join("   "));
    for (const row of dataRows) {
      cli.print(formatRow(row[0], row[1], row[2], row[3]));
    }
    cli.print(colWidths.map(w => "─".repeat(w)).join("   "));
    cli.print(formatRow(totalRow[0], totalRow[1], totalRow[2], totalRow[3]));
  },
});

export default summary;