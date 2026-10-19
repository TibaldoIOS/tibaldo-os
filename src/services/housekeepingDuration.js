export const MAX_HOUSEKEEPING_DURATION_MINUTES = 24 * 60;

const numericFrenchPattern = /^\d+(?:[\u00a0\u202f ]\d{3})*(?:[,.]\d+)?$/;

export function parseHousekeepingDuration(value) {
  const raw = value == null ? "" : String(value).trim();

  if (!raw) {
    return { raw, minutes: null, valid: false, reason: "DURATION_MISSING" };
  }

  if (!numericFrenchPattern.test(raw)) {
    return { raw, minutes: null, valid: false, reason: "DURATION_NOT_NUMERIC" };
  }

  const normalized = raw.replace(/[\u00a0\u202f ]/g, "").replace(",", ".");
  const minutes = Number(normalized);

  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_HOUSEKEEPING_DURATION_MINUTES) {
    return { raw, minutes: null, valid: false, reason: "DURATION_OUT_OF_RANGE" };
  }

  return { raw, minutes, valid: true, reason: null };
}

export function summarizeHousekeepingDurations(rows) {
  const validRows = rows.filter((row) => row.durationValid === true && Number.isFinite(row.minutes));

  return {
    totalMinutes: validRows.reduce((total, row) => total + row.minutes, 0),
    validCount: validRows.length,
    invalidCount: rows.length - validRows.length,
    complete: validRows.length === rows.length,
  };
}

export function housekeepingDurationIssueLabel(reason) {
  if (reason === "DURATION_MISSING") return "Durée manquante — exclue des heures et de la paie";
  if (reason === "DURATION_OUT_OF_RANGE") return "Durée hors limites — exclue des heures et de la paie";
  return "Durée non numérique — exclue des heures et de la paie";
}
