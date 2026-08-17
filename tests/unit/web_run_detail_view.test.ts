import assert from "node:assert/strict";
import test from "node:test";

import {
  coverageView,
  primaryMetricView,
  sampleFilterQuery,
  sampleResultStatus,
} from "../../apps/web/src/pages/runDetailView.ts";

const numericMetrics = {
  primary_metric: "numeric_match",
  metrics: {
    numeric_match: 884 / 991,
    numeric_match_numerator: 884,
    numeric_match_denominator: 991,
    total_samples: 1319,
    scored_samples: 991,
  },
  denominators: { numeric_match: 991 },
};

test("primary metric view follows the backend metric name", () => {
  assert.deepEqual(primaryMetricView(numericMetrics, 1319), {
    key: "numeric_match",
    label: "Numeric Match",
    value: 884 / 991,
    numerator: 884,
    denominator: 991,
  });
});

test("coverage reports the share of samples included in the primary metric", () => {
  assert.deepEqual(coverageView(numericMetrics, 1319), {
    value: 991 / 1319,
    numerator: 991,
    denominator: 1319,
  });
});

test("sample result status combines execution and scoring outcomes", () => {
  assert.equal(sampleResultStatus({ status: "SUCCEEDED", passed: true }), "PASSED");
  assert.equal(sampleResultStatus({ status: "SUCCEEDED", passed: false }), "FAILED");
  assert.equal(sampleResultStatus({ status: "SUCCEEDED", passed: null }), "SCORE_ERROR");
  assert.equal(sampleResultStatus({ status: "API_ERROR", passed: null }), "API_ERROR");
  assert.equal(sampleResultStatus({ status: "PARSE_ERROR", passed: null }), "PARSE_ERROR");
  assert.equal(sampleResultStatus({ status: "SCORE_ERROR", passed: null }), "SCORE_ERROR");
});

test("sample filters use both execution and scoring fields", () => {
  assert.equal(sampleFilterQuery("ALL"), "");
  assert.equal(sampleFilterQuery("PASSED"), "&status=SUCCEEDED&passed=true");
  assert.equal(sampleFilterQuery("FAILED"), "&status=SUCCEEDED&passed=false");
  assert.equal(sampleFilterQuery("API_ERROR"), "&status=API_ERROR");
  assert.equal(sampleFilterQuery("PARSE_ERROR"), "&status=PARSE_ERROR");
  assert.equal(sampleFilterQuery("SCORE_ERROR"), "&status=SCORE_ERROR");
});
