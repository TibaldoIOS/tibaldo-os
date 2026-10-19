import assert from "node:assert/strict";
import test from "node:test";
import {
  parseHousekeepingDuration,
  summarizeHousekeepingDurations,
} from "./housekeepingDuration.js";

test("accepts canonical minutes used by housekeeping and customer service", () => {
  assert.deepEqual(parseHousekeepingDuration("115"), { raw: "115", minutes: 115, valid: true, reason: null });
  assert.deepEqual(parseHousekeepingDuration("150"), { raw: "150", minutes: 150, valid: true, reason: null });
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

test("rejects 51110 minutes as out of range", () => {
  assert.deepEqual(parseHousekeepingDuration("51110"), {
    raw: "51110",
    minutes: null,
    valid: false,
    reason: "DURATION_OUT_OF_RANGE",
  });
});

test("excludes invalid rows from totals instead of silently turning them into zero", () => {
  const menage = parseHousekeepingDuration("150");
  const serviceClient = parseHousekeepingDuration("115");
  const invalid = parseHousekeepingDuration("Service client du 5 au 11/10");
  const summary = summarizeHousekeepingDurations([
    { serviceType: "Ménage Airbnb", durationValid: menage.valid, minutes: menage.minutes },
    { serviceType: "Service client", durationValid: serviceClient.valid, minutes: serviceClient.minutes },
    { serviceType: "Service client", durationValid: invalid.valid, minutes: invalid.minutes },
  ]);

  assert.deepEqual(summary, { totalMinutes: 265, validCount: 2, invalidCount: 1, complete: false });
  assert.equal(summary.totalMinutes / 60, 4 + 25 / 60);
});

test("marks a fully valid 10–11 October total as complete", () => {
  const rows = ["150", "115"].map((raw) => {
    const duration = parseHousekeepingDuration(raw);
    return { durationValid: duration.valid, minutes: duration.minutes };
  });

  assert.deepEqual(summarizeHousekeepingDurations(rows), {
    totalMinutes: 265,
    validCount: 2,
    invalidCount: 0,
    complete: true,
  });
});
