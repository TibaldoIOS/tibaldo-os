import assert from "node:assert/strict";
import test from "node:test";
import { OPENING_PLAN, daysUntilOpening, isOverdue, progressFor, tomorrowIso } from "./openingPlan.js";

test("opening plan covers the five approved phases without saturating every day", () => {
  assert.ok(OPENING_PLAN.length >= 40);
  assert.equal(new Set(OPENING_PLAN.map((item) => item.seed_key)).size, OPENING_PLAN.length);
  assert.ok(OPENING_PLAN.some((item) => item.week_label === "26 SEPT. — OUVERTURE"));
  assert.ok(OPENING_PLAN.some((item) => item.effort === "LIGHT"));
  assert.ok(OPENING_PLAN.some((item) => item.title.includes("chatons")));
});

test("opening countdown is based on the authoritative opening instant", () => {
  assert.equal(daysUntilOpening(new Date("2026-09-25T18:00:00+02:00")), 1);
  assert.equal(daysUntilOpening(new Date("2026-09-27T12:00:00+02:00")), 0);
});

test("overdue ignores completed tasks", () => {
  assert.equal(isOverdue({ due_date: "2026-08-27", status: "TODO" }, "2026-08-28"), true);
  assert.equal(isOverdue({ due_date: "2026-08-27", status: "DONE" }, "2026-08-28"), false);
});

test("progress and tomorrow helpers are deterministic", () => {
  assert.equal(progressFor([{ status: "DONE" }, { status: "TODO" }]), 50);
  assert.equal(progressFor([]), 0);
  assert.equal(tomorrowIso("2026-08-31"), "2026-09-01");
});
