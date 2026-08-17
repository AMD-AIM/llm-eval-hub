export const SAMPLE_FILTERS = [
  "ALL",
  "PASSED",
  "FAILED",
  "API_ERROR",
  "PARSE_ERROR",
  "SCORE_ERROR",
] as const;

export type SampleFilter = (typeof SAMPLE_FILTERS)[number];

interface DatasetMetrics {
  primary_metric?: string;
  metrics: Record<string, number | null>;
  denominators: Record<string, number>;
}

interface SampleResult {
  status: string;
  passed: boolean | null;
}

const metricLabels: Record<string, string> = {
  accuracy: "Accuracy",
  exact_match: "Exact Match",
  macro_f1: "Macro F1",
  numeric_match: "Numeric Match",
};

function metricNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function metricLabel(metric: string): string {
  return metricLabels[metric] ?? metric
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function primaryMetricView(dataset: DatasetMetrics | undefined, fallbackTotal: number) {
  const key = dataset?.primary_metric || "accuracy";
  const metrics = dataset?.metrics ?? {};
  const value = metricNumber(metrics[key]);
  const numerator = metricNumber(metrics[`${key}_numerator`]);
  const denominator = metricNumber(metrics[`${key}_denominator`])
    ?? metricNumber(dataset?.denominators[key])
    ?? (value != null && fallbackTotal > 0 ? fallbackTotal : null);

  return {
    key,
    label: metricLabel(key),
    value,
    numerator,
    denominator,
  };
}

export function coverageView(dataset: DatasetMetrics | undefined, fallbackTotal: number) {
  if (!dataset) return { value: null, numerator: null, denominator: null };
  const primary = primaryMetricView(dataset, fallbackTotal);
  const metrics = dataset?.metrics ?? {};
  const covered = metricNumber(metrics.scored_samples)
    ?? primary.denominator
    ?? metricNumber(metrics.valid_responses);
  const total = metricNumber(metrics.total_samples)
    ?? (fallbackTotal > 0 ? fallbackTotal : null);

  return {
    value: covered != null && total != null && total > 0 ? covered / total : null,
    numerator: covered,
    denominator: total,
  };
}

export function sampleResultStatus(sample: SampleResult): string {
  if (sample.status === "SUCCEEDED") {
    if (sample.passed === true) return "PASSED";
    if (sample.passed === false) return "FAILED";
    return "SCORE_ERROR";
  }
  return sample.status;
}

export function sampleFilterQuery(filter: SampleFilter): string {
  if (filter === "ALL") return "";
  if (filter === "PASSED") return "&status=SUCCEEDED&passed=true";
  if (filter === "FAILED") return "&status=SUCCEEDED&passed=false";
  return `&status=${filter}`;
}
