import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
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

interface ColumnSpec {
  header: string;
  align: "left" | "right";
}

const NO_METRICS_MESSAGE = "No metrics recorded yet. Run an output to start collecting metrics.\n";

/**
 * Print a formatted table with headers, data rows, separators, and a total row.
 * Column widths are computed from the widest cell across headers, data, and total.
 * Each column is padded according to its alignment spec.
 */
function printTable(columns: ColumnSpec[], dataRows: string[][], totalRow: string[]): void {
  const headers = columns.map(c => c.header);

  const colWidths = headers.map((h, i) =>
    Math.max(
      h.length,
      ...dataRows.map(r => r[i].length),
      totalRow[i].length,
    ),
  );

  const formatRow = (cells: string[]): string =>
    cells.map((cell, i) =>
      columns[i].align === "left"
        ? cell.padEnd(colWidths[i])
        : cell.padStart(colWidths[i]),
    ).join("   ");

  const separator = colWidths.map(w => "─".repeat(w)).join("   ");

  cli.print(formatRow(headers) + "\n");
  cli.print(separator + "\n");
  for (const row of dataRows) {
    cli.print(formatRow(row) + "\n");
  }
  cli.print(separator + "\n");
  cli.print(formatRow(totalRow) + "\n");
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
    const root = props.context?.root ?? await runtime.projectRoot();
    const globalRoot = props.context?.globalRoot;
    const isAll = is.defined(props.flags.all);

    if (isAll) {
      const entries: ProjectMetricsEntry[] = await readAllMetrics({ globalRoot });

      if (entries.length === 0) {
        cli.print(NO_METRICS_MESSAGE);
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

      const columns: ColumnSpec[] = [
        { header: "Project", align: "left" },
        { header: "Output", align: "left" },
        { header: "Runs", align: "right" },
        { header: "Characters", align: "right" },
        { header: "Est. Tokens powerups", align: "right" },
      ];

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

      printTable(columns, dataRows, totalRow);
    } else {
      const entries: MetricsEntry[] = await readMetrics({ cwd: root.path, globalRoot });

      if (entries.length === 0) {
        cli.print(NO_METRICS_MESSAGE);
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

      const columns: ColumnSpec[] = [
        { header: "Output", align: "left" },
        { header: "Runs", align: "right" },
        { header: "Characters", align: "right" },
        { header: "Est. Tokens powerups", align: "right" },
      ];

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

      printTable(columns, dataRows, totalRow);
    }
  },
});

export default summary;