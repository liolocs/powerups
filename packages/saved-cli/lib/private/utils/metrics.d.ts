import { type FileRef } from "@rcompat/fs";
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
export declare function logRun({ pattern, characters }: Omit<MetricsEntry, "timestamp">, rootOverride?: FileRef): Promise<void>;
/**
 * Read all metrics entries from `.saved/metrics.jsonl`.
 * Returns an empty array if the file doesn't exist.
 * Skips blank lines and lines that fail JSON.parse.
 */
export declare function readMetrics(rootOverride?: FileRef): Promise<MetricsEntry[]>;
//# sourceMappingURL=metrics.d.ts.map