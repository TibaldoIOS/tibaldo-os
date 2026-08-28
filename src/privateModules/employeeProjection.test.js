import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration, minutesInPeriod, workspaceForRole } from "./employeeProjection.js";

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
