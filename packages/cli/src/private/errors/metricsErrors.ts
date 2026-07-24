const metrics_errors = {} as Record<string, never>;

export type MetricsErrorCode = keyof typeof metrics_errors;

export const MetricsErrorCode = Object.fromEntries(
  Object.keys(metrics_errors).map(k => [k, k]),
) as { [K in MetricsErrorCode]: K };

export default metrics_errors;