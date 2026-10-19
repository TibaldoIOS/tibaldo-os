const numericFrenchPattern = /^\d+(?:[\u00a0\u202f ]\d{3})*(?:[,.]\d+)?$/;

export function isHousekeepingDurationRequired(serviceType) {
  const normalized = String(serviceType || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return !normalized.startsWith("linge") && !/^achats?$/.test(normalized);
}

export function parseHousekeepingDuration(value, { required = true } = {}) {
  const raw = value == null ? "" : String(value).trim();

  if (!raw) {
    return required
      ? { raw, minutes: null, valid: false, applicable: true, reason: "DURATION_MISSING" }
      : { raw, minutes: null, valid: true, applicable: false, reason: null };
  }

  if (!numericFrenchPattern.test(raw)) {
    return { raw, minutes: null, valid: false, applicable: true, reason: "DURATION_NOT_NUMERIC" };
  }

  const normalized = raw.replace(/[\u00a0\u202f ]/g, "").replace(",", ".");
  const minutes = Number(normalized);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { raw, minutes: null, valid: false, applicable: true, reason: "DURATION_NOT_POSITIVE" };
  }

  return { raw, minutes, valid: true, applicable: true, reason: null };
}

export function summarizeHousekeepingDurations(rows) {
  const applicableRows = rows.filter((row) => row.durationApplicable !== false);
  const validRows = applicableRows.filter((row) => row.durationValid === true && Number.isFinite(row.minutes));

  return {
    totalMinutes: validRows.reduce((total, row) => total + row.minutes, 0),
    validCount: validRows.length,
    invalidCount: applicableRows.length - validRows.length,
    notApplicableCount: rows.length - applicableRows.length,
    complete: validRows.length === applicableRows.length,
  };
}

export function summarizeHousekeepingCompensation(rows, hourlyRate, linenRate) {
  const duration = summarizeHousekeepingDurations(rows);
  const linenCleaned = rows.reduce((total, row) => total + (Number(row.linenCleaned) || 0), 0);
  const purchases = rows.reduce((total, row) => total + (Number(row.purchases) || 0), 0);
  const totalHours = duration.totalMinutes / 60;
  const laborEstimate = totalHours * hourlyRate;
  const linenPay = linenCleaned * linenRate;

  return {
    ...duration,
    totalHours,
    laborEstimate,
    linenCleaned,
    linenPay,
    purchases,
    totalToPayEstimate: laborEstimate + linenPay + purchases,
  };
}

export function housekeepingDurationIssueLabel(reason) {
  if (reason === "DURATION_MISSING") return "Durée manquante — exclue des heures et de la paie";
  if (reason === "DURATION_NOT_POSITIVE") return "Durée non positive — exclue des heures et de la paie";
  return "Durée non numérique — exclue des heures et de la paie";
}
