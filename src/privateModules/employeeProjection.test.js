import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarDayKey,
  currentEmployeePeriods,
  employeeHoursSummary,
  entryPropertyPresentation,
  formatDuration,
  groupInterventionsByDay,
  minutesInPeriod,
  recordedTimeLabel,
  reportPeriod,
  serviceDisplayLabel,
  serviceSemanticKey,
  compareEntriesNewest,
  workspaceForRole,
} from "./employeeProjection.js";

test("safe semantic subtype distinguishes service client without renaming other misc work", () => {
  assert.equal(serviceSemanticKey({ service_type: "MISC_SERVICE", semantic_subtype: "SERVICE_CLIENT" }), "SERVICE_CLIENT");
  assert.equal(serviceDisplayLabel({ service_type: "MISC_SERVICE", semantic_subtype: "SERVICE_CLIENT" }), "Service client");
  assert.equal(serviceDisplayLabel({ service_type: "MISC_SERVICE" }), "Autre prestation");
  assert.equal(serviceDisplayLabel({ service_type: "HOUSEKEEPING" }), "Ménage");
});

test("safe source property context stays secondary to canonical property", () => {
  assert.deepEqual(entryPropertyPresentation({ mapping_status: "NO_PROPERTY_REQUIRED", source_property_context: "Tibado House" }), {
    key: "SOURCE:Tibado House", label: "Tibado House", context: "Sans logement canonique requis",
  });
  assert.deepEqual(entryPropertyPresentation({ property: "Fives", source_property_context: "Tibado House" }), {
    key: "Fives", label: "Fives", context: "",
  });
  assert.equal(entryPropertyPresentation({ mapping_status: "NO_PROPERTY_REQUIRED" }).label, "Sans logement requis");
});

test("entry ordering uses submission time only as a deterministic tie-breaker", () => {
  const rows = [
    { id: "a", service_date: "2026-09-01", source_submitted_at: "2026-09-01T14:16:49Z" },
    { id: "b", service_date: "2026-09-01", source_submitted_at: "2026-09-01T14:18:37Z" },
    { id: "c", service_date: "2026-08-31", source_submitted_at: "2026-09-02T09:00:00Z" },
  ].sort(compareEntriesNewest);
  assert.deepEqual(rows.map((item) => item.id), ["b", "a", "c"]);
});

test("employee durations are calculated from the existing filtered projection", () => {
  const entries = [
    { occurred_at: "2026-08-28T08:00:00Z", minutes: 90, status: "validated" },
    { occurred_at: "2026-08-28T10:00:00Z", minutes: 45, status: "validated" },
    { occurred_at: "2026-08-28T12:00:00Z", minutes: 60, status: "cancelled" },
  ];
  assert.equal(minutesInPeriod(entries, new Date("2026-08-28T00:00:00Z"), new Date("2026-08-28T23:59:59Z")), 135);
  assert.equal(formatDuration(135), "2 h 15");
});

test("unknown roles fail closed and employees never resolve to the Owner workspace", () => {
  assert.equal(workspaceForRole("OWNER"), "OWNER");
  assert.equal(workspaceForRole("EMPLOYEE"), "EMPLOYEE");
  assert.equal(workspaceForRole("ADMIN"), "DENIED");
  assert.equal(workspaceForRole(null), "DENIED");
});

test("calendar periods use Europe/Paris with Monday week and calendar-month boundaries", () => {
  const reference = new Date("2026-09-02T10:00:00Z");
  assert.deepEqual(currentEmployeePeriods(reference), {
    today: { startKey: "2026-09-02", endKey: "2026-09-02" },
    week: { startKey: "2026-08-31", endKey: "2026-09-06" },
    month: { startKey: "2026-09-01", endKey: "2026-09-30" },
  });
  assert.equal(calendarDayKey("2026-08-31T22:30:00Z"), "2026-09-01");
  assert.equal(reportPeriod("PREVIOUS_MONTH", reference).startKey, "2026-08-01");
  assert.equal(reportPeriod("MONTH", reference, -2).startKey, "2026-07-01");
});

test("daily report groups multiple properties, preserves a recorded zero-hour row and excludes cancellations", () => {
  const period = reportPeriod("MONTH", new Date("2026-09-15T12:00:00Z"));
  const entries = [
    { id: "a", occurred_at: "2026-09-01T06:00:00Z", property: "Fives", minutes: 60, status: "validated" },
    { id: "b", occurred_at: "2026-09-01T09:00:00Z", property: "Studio", minutes: 90, status: "validated" },
    { id: "c", occurred_at: "2026-09-01T10:00:00Z", property: "Wattignies", minutes: 0, status: "validated" },
    { id: "d", occurred_at: "2026-09-01T11:00:00Z", property: "Annulée", minutes: 300, status: "cancelled" },
    { id: "e", occurred_at: "2026-09-02T07:00:00Z", property: "Calais", minutes: 45, status: "completed" },
  ];
  const days = groupInterventionsByDay(entries, period);
  assert.equal(days.length, 2);
  assert.equal(days[0].key, "2026-09-02");
  assert.equal(days[0].totalMinutes, 45);
  assert.equal(days[1].key, "2026-09-01");
  assert.deepEqual(days[1].interventions.map((item) => item.property), ["Fives", "Studio", "Wattignies"]);
  assert.equal(days[1].totalMinutes, 150);
});

test("today, week and month summaries do not leak across their boundaries", () => {
  const reference = new Date("2026-09-02T10:00:00Z");
  const entries = [
    { occurred_at: "2026-09-02T06:00:00Z", minutes: 30, status: "validated" },
    { occurred_at: "2026-09-01T06:00:00Z", minutes: 60, status: "validated" },
    { occurred_at: "2026-08-31T12:00:00Z", minutes: 90, status: "validated" },
    { occurred_at: "2026-09-06T21:59:00Z", minutes: 15, status: "validated" },
    { occurred_at: "2026-09-06T22:00:00Z", minutes: 240, status: "validated" },
    { occurred_at: "2026-08-30T10:00:00Z", minutes: 180, status: "validated" },
  ];
  assert.deepEqual(employeeHoursSummary(entries, reference), {
    today: 30,
    week: 195,
    month: 345,
  });
});

test("a projected timestamp is described as recorded time, never fabricated as an intervention start", () => {
  const label = recordedTimeLabel("2026-09-01T08:15:00Z");
  assert.match(label, /^Enregistré à /);
  assert.doesNotMatch(label, /Début/);
});
