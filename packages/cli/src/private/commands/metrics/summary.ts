import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import {
  readMetrics,
  readAllMetrics,
  type MetricsEntry,
  type ProjectMetricsEntry,
} from "#utils/metrics";

interface OutputAggregate {
  runs: number;
  characters: number;
}

const summary = new Command({
  name: "summary",
  description: "Show aggregated metrics for all output runs",
  flags: [
    {
      name: "all",
      long: "all",
      short: "g",
      description: "Show aggregated metrics across all projects",
    },
  ],
  subcommands: [],
  action: async (props) => {
    const root = props?.context?.root ?? await runtime.projectRoot();
    const globalRoot = props?.context?.globalRoot;
    const isAll = is.defined(props?.flags?.all);

    if (isAll) {
      const entries: ProjectMetricsEntry[] = await readAllMetrics({ globalRoot });

      if (entries.length === 0) {
        cli.print("No metrics recorded yet. Run a output to start collecting metrics.\n");
        return;
      }

      // Aggregate by (project, output)
      const byProjectOutput = new Map<string, { project: string; output: string; runs: number; characters: number }>();
      for (const entry of entries) {
        const key = `${entry.project}\t${entry.output}`;
        const existing = byProjectOutput.get(key) ?? { project: entry.project, output: entry.output, runs: 0, characters: 0 };
        existing.runs += 1;
        existing.characters += entry.characters;
        byProjectOutput.set(key, existing);
      }

      // Sort by project, then characters descending within each project
      const rows = [...byProjectOutput.values()].sort((a, b) => {
        if (a.project !== b.project) return a.project.localeCompare(b.project);
        return b.characters - a.characters;
      });

      // Compute totals
      const totalRuns = rows.reduce((sum, r) => sum + r.runs, 0);
      const totalCharacters = rows.reduce((sum, r) => sum + r.characters, 0);
      const totalEstTokens = Math.round(totalCharacters / 4);

      // Column definitions
      const headers = ["Project", "Output", "Runs", "Characters", "Est. Tokens powerups"];

      // Build string rows for width calculation
      const dataRows = rows.map(r => [
        r.project,
        r.output,
        r.runs.toLocaleString(),
        r.characters.toLocaleString(),
        `~${Math.round(r.characters / 4).toLocaleString()}`,
      ]);
      const totalRow = [
        "TOTAL",
        "",
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

      // Row formatter: project and output left-aligned, numbers right-aligned
      const formatRow = (project: string, output: string, runs: string, chars: string, tokens: string) =>
        `${project.padEnd(colWidths[0])}   ${output.padEnd(colWidths[1])}   ${runs.padStart(colWidths[2])}   ${chars.padStart(colWidths[3])}   ${tokens.padStart(colWidths[4])}`;

      // Print table
      cli.print(formatRow(headers[0], headers[1], headers[2], headers[3], headers[4]) + "\n");
      cli.print(colWidths.map(w => "─".repeat(w)).join("   ") + "\n");
      for (const row of dataRows) {
        cli.print(formatRow(row[0], row[1], row[2], row[3], row[4]) + "\n");
      }
      cli.print(colWidths.map(w => "─".repeat(w)).join("   ") + "\n");
      cli.print(formatRow(totalRow[0], totalRow[1], totalRow[2], totalRow[3], totalRow[4]) + "\n");
    } else {
      const entries: MetricsEntry[] = await readMetrics({ cwd: root.path, globalRoot });

      if (entries.length === 0) {
        cli.print("No metrics recorded yet. Run a output to start collecting metrics.\n");
        return;
      }

      // Aggregate by output name
      const byOutput = new Map<string, OutputAggregate>();

      for (const entry of entries) {
        const existing = byOutput.get(entry.output) ?? { runs: 0, characters: 0 };
        existing.runs += 1;
        existing.characters += entry.characters;
        byOutput.set(entry.output, existing);
      }

      // Build rows, sorted by characters descending
      const rows = [...byOutput.entries()]
        .map(([output, agg]) => ({
          output,
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
      const headers = ["Output", "Runs", "Characters", "Est. Tokens powerups"];

      // Build string rows for width calculation
      const dataRows = rows.map(r => [
        r.output,
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

      // Row formatter: output left-aligned, numbers right-aligned
      const formatRow = (output: string, runs: string, chars: string, tokens: string) =>
        `${output.padEnd(colWidths[0])}   ${runs.padStart(colWidths[1])}   ${chars.padStart(colWidths[2])}   ${tokens.padStart(colWidths[3])}`;

      // Print table
      cli.print(formatRow(headers[0], headers[1], headers[2], headers[3]) + "\n");
      cli.print(colWidths.map(w => "─".repeat(w)).join("   ") + "\n");
      for (const row of dataRows) {
        cli.print(formatRow(row[0], row[1], row[2], row[3]) + "\n");
      }
      cli.print(colWidths.map(w => "─".repeat(w)).join("   ") + "\n");
      cli.print(formatRow(totalRow[0], totalRow[1], totalRow[2], totalRow[3]) + "\n");
    }
  },
});

export default summary;