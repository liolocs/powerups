export interface MetricsEntry {
    timestamp: string;
    pattern: string;
    characters: number;
}
/**
 * Append a metrics entry to `.saved/metrics.jsonl`.
 * Creates the file if it doesn't exist. Best-effort — callers should
 * wrap in try/catch if logging failures must not crash the run.
 */
export declare function logRun({ pattern, characters }: Omit<MetricsEntry, "timestamp">): Promise<void>;
/**
 * Read all metrics entries from `.saved/metrics.jsonl`.
 * Returns an empty array if the file doesn't exist.
 * Skips blank lines and lines that fail JSON.parse.
 */
export declare function readMetrics(): Promise<MetricsEntry[]>;
//# sourceMappingURL=metrics.d.ts.map