export function minutesInPeriod(entries, from, to = new Date()) {
  return entries
    .filter((item) => {
      const occurredAt = new Date(item.occurred_at);
      return occurredAt >= from && occurredAt <= to && item.status !== "cancelled";
    })
    .reduce((sum, item) => sum + Number(item.minutes || 0), 0);
}

export function formatDuration(minutes = 0) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  return `${Math.floor(safeMinutes / 60)} h ${String(safeMinutes % 60).padStart(2, "0")}`;
}

export function workspaceForRole(role) {
  if (role === "OWNER") return "OWNER";
  if (role === "EMPLOYEE") return "EMPLOYEE";
  return "DENIED";
}
