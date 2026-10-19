import assert from "node:assert/strict";
import test from "node:test";
import {
  parseHousekeepingDuration,
  summarizeHousekeepingCompensation,
  summarizeHousekeepingDurations,
} from "./housekeepingDuration.js";

test("accepts canonical minutes used by housekeeping and customer service", () => {
  assert.deepEqual(parseHousekeepingDuration("115"), { raw: "115", minutes: 115, valid: true, applicable: true, reason: null });
  assert.deepEqual(parseHousekeepingDuration("150"), { raw: "150", minutes: 150, valid: true, applicable: true, reason: null });
});

test("preserves valid French decimal and grouped numeric formats", () => {
  assert.equal(parseHousekeepingDuration("115,5").minutes, 115.5);
  assert.equal(parseHousekeepingDuration("115.5").minutes, 115.5);
  assert.equal(parseHousekeepingDuration("1 150,5").minutes, 1150.5);
  assert.equal(parseHousekeepingDuration("1\u202f150,5").minutes, 1150.5);
});

test("rejects the proven text regression without extracting date digits", () => {
  const result = parseHousekeepingDuration("Service client du 5 au 11/10");
  assert.equal(result.valid, false);
  assert.equal(result.minutes, null);
  assert.equal(result.reason, "DURATION_NOT_NUMERIC");
});

test("rejects dates, arbitrary text and empty values", () => {
  for (const value of ["11/10/2026", "texte", "12 minutes", "", null]) {
    const result = parseHousekeepingDuration(value);
    assert.equal(result.valid, false);
    assert.equal(result.minutes, null);
  }
});

test("accepts positive numeric cumulative durations above 24 hours", () => {
  assert.equal(parseHousekeepingDuration("2880").minutes, 2880);
  assert.equal(parseHousekeepingDuration("51110").minutes, 51110);
});

test("excludes invalid rows from totals instead of silently turning them into zero", () => {
  const menage = parseHousekeepingDuration("150");
  const serviceClient = parseHousekeepingDuration("115");
  const invalid = parseHousekeepingDuration("Service client du 5 au 11/10");
  const summary = summarizeHousekeepingDurations([
    { serviceType: "Ménage Airbnb", durationValid: menage.valid, durationApplicable: menage.applicable, minutes: menage.minutes },
    { serviceType: "Service client", durationValid: serviceClient.valid, durationApplicable: serviceClient.applicable, minutes: serviceClient.minutes },
    { serviceType: "Service client", durationValid: invalid.valid, durationApplicable: invalid.applicable, minutes: invalid.minutes },
  ]);

  assert.deepEqual(summary, { totalMinutes: 265, validCount: 2, invalidCount: 1, notApplicableCount: 0, complete: false });
  assert.equal(summary.totalMinutes / 60, 4 + 25 / 60);
});

test("marks a fully valid 10–11 October total as complete", () => {
  const rows = ["150", "115"].map((raw) => {
    const duration = parseHousekeepingDuration(raw);
    return { durationValid: duration.valid, durationApplicable: duration.applicable, minutes: duration.minutes };
  });

  assert.deepEqual(summarizeHousekeepingDurations(rows), {
    totalMinutes: 265,
    validCount: 2,
    invalidCount: 0,
    notApplicableCount: 0,
    complete: true,
  });
});

test("treats an empty linen duration as non-applicable and preserves linen pay", () => {
  const duration = parseHousekeepingDuration("", { required: false });
  const summary = summarizeHousekeepingCompensation([{
    serviceType: "Linge",
    durationValid: duration.valid,
    durationApplicable: duration.applicable,
    minutes: duration.minutes,
    linenCleaned: 3,
    purchases: 0,
  }], 15, 3);

  assert.equal(duration.valid, true);
  assert.equal(duration.applicable, false);
  assert.equal(summary.invalidCount, 0);
  assert.equal(summary.complete, true);
  assert.equal(summary.laborEstimate, 0);
  assert.equal(summary.linenPay, 9);
  assert.equal(summary.totalToPayEstimate, 9);
});

test("keeps an empty housekeeping duration visible as an incomplete anomaly", () => {
  const duration = parseHousekeepingDuration("", { required: true });
  const summary = summarizeHousekeepingDurations([{
    serviceType: "Ménage Airbnb",
    durationValid: duration.valid,
    durationApplicable: duration.applicable,
    minutes: duration.minutes,
  }]);

  assert.equal(duration.valid, false);
  assert.equal(duration.reason, "DURATION_MISSING");
  assert.equal(summary.invalidCount, 1);
  assert.equal(summary.complete, false);
});
