export const EMPLOYEE_TIME_ZONE = "Europe/Paris";

const SERVICE_LABELS = {
  HOUSEKEEPING: "Ménage",
  LAUNDRY: "Linge",
  MISC_SERVICE: "Autre prestation",
  PURCHASE: "Achat",
  SERVICE_CLIENT: "Service client",
};

export function serviceSemanticKey(item = {}) {
  return item.semantic_subtype === "SERVICE_CLIENT" ? "SERVICE_CLIENT" : item.service_type;
}

export function serviceDisplayLabel(item = {}) {
  return SERVICE_LABELS[serviceSemanticKey(item)] || "Prestation";
}

export function entryPropertyPresentation(item = {}) {
  if (["PROPERTY_REVIEW_REQUIRED", "OWNER_REVIEW_REQUIRED"].includes(item.mapping_status)) {
    return { key: "PROPERTY_REVIEW_REQUIRED", label: "Logement à vérifier", context: "" };
  }
  if (item.property) return { key: item.property, label: item.property, context: "" };
  if (item.source_property_context) {
    return { key: `SOURCE:${item.source_property_context}`, label: item.source_property_context, context: "Sans logement canonique requis" };
  }
  return { key: "NO_PROPERTY_REQUIRED", label: "Sans logement requis", context: "" };
}

export function compareEntriesNewest(left, right) {
  return String(right.service_date || "").localeCompare(String(left.service_date || ""))
    || String(right.source_submitted_at || "").localeCompare(String(left.source_submitted_at || ""))
    || String(right.id || "").localeCompare(String(left.id || ""));
}

const calendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EMPLOYEE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayLabelFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: EMPLOYEE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

function calendarParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    calendarFormatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return { year: parts.year, month: parts.month, day: parts.day };
}

function keyFromParts({ year, month, day }) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function keyAsUtcDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function shiftKey(key, days) {
  const date = keyAsUtcDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthKey(referenceKey, offset) {
  const date = keyAsUtcDate(referenceKey);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

function monthEndKey(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0, 12)).toISOString().slice(0, 10);
}

function normalizedMinutes(item) {
  return Math.max(0, Number(item?.minutes) || 0);
}

export function calendarDayKey(value) {
  const parts = calendarParts(value);
  return parts ? keyFromParts(parts) : null;
}

export function isCountedIntervention(item) {
  return Boolean(calendarDayKey(item?.occurred_at)) && item?.status !== "cancelled";
}

export function currentEmployeePeriods(reference = new Date()) {
  const today = calendarDayKey(reference);
  const todayUtc = keyAsUtcDate(today);
  const mondayOffset = (todayUtc.getUTCDay() + 6) % 7;
  const weekStart = shiftKey(today, -mondayOffset);
  const currentMonth = today.slice(0, 7);

  return {
    today: { startKey: today, endKey: today },
    week: { startKey: weekStart, endKey: shiftKey(weekStart, 6) },
    month: { startKey: `${currentMonth}-01`, endKey: monthEndKey(currentMonth) },
  };
}

export function reportPeriod(selection = "CURRENT_WEEK", reference = new Date(), monthOffset = 0) {
  const periods = currentEmployeePeriods(reference);
  if (selection === "CURRENT_WEEK") {
    return { ...periods.week, label: "Cette semaine", totalLabel: "TOTAL SEMAINE" };
  }

  const baseMonthOffset = selection === "PREVIOUS_MONTH" ? -1 : monthOffset;
  const selectedMonth = monthKey(calendarDayKey(reference), baseMonthOffset);
  const monthDate = keyAsUtcDate(`${selectedMonth}-01`);
  return {
    startKey: `${selectedMonth}-01`,
    endKey: monthEndKey(selectedMonth),
    label: new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "long", year: "numeric" }).format(monthDate),
    totalLabel: "TOTAL MOIS",
  };
}

export function minutesInCalendarRange(entries, startKey, endKey) {
  return entries
    .filter((item) => {
      const key = calendarDayKey(item?.occurred_at);
      return isCountedIntervention(item) && key >= startKey && key <= endKey;
    })
    .reduce((sum, item) => sum + normalizedMinutes(item), 0);
}

export function employeeHoursSummary(entries, reference = new Date()) {
  const periods = currentEmployeePeriods(reference);
  return {
    today: minutesInCalendarRange(entries, periods.today.startKey, periods.today.endKey),
    week: minutesInCalendarRange(entries, periods.week.startKey, periods.week.endKey),
    month: minutesInCalendarRange(entries, periods.month.startKey, periods.month.endKey),
  };
}

export function groupInterventionsByDay(entries, period) {
  const groups = new Map();
  entries.forEach((item) => {
    const key = calendarDayKey(item?.occurred_at);
    if (!isCountedIntervention(item) || key < period.startKey || key > period.endKey) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, items]) => {
      const interventions = [...items].sort((left, right) => (
        new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime()
      ));
      return {
        key,
        label: dayLabelFormatter.format(keyAsUtcDate(key)),
        interventions,
        totalMinutes: interventions.reduce((sum, item) => sum + normalizedMinutes(item), 0),
      };
    });
}

export function recordedTimeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : `Enregistré à ${timeFormatter.format(date)}`;
}

export function minutesInPeriod(entries, from, to = new Date()) {
  return entries
    .filter((item) => {
      const occurredAt = new Date(item.occurred_at);
      return occurredAt >= from && occurredAt <= to && isCountedIntervention(item);
    })
    .reduce((sum, item) => sum + normalizedMinutes(item), 0);
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
