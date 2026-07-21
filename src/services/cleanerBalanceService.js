export const DEFAULT_HOURLY_RATE = 15;
export const DEFAULT_LINEN_RATE = 3;

export function getCurrentWeekStart(now = new Date()) {
  const start = new Date(now);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function parseHousekeepingCsv(csvText) {
  const matrix = parseCsvMatrix(csvText);
  const columns = makeUniqueColumns(matrix[0] || []);
  const rows = matrix.slice(1).map((line) =>
    Object.fromEntries(columns.map((column, index) => [column, String(line[index] || "").trim()]))
  );

  return { columns, rows };
}

export function calculateCleanerBalances(csvText, payments = [], options = {}) {
  const hourlyRate = toNumber(options.hourlyRate ?? DEFAULT_HOURLY_RATE);
  const linenRate = toNumber(options.linenRate ?? DEFAULT_LINEN_RATE);
  const startDate = options.startDate ? startOfDay(options.startDate) : null;
  const { columns, rows } = parseHousekeepingCsv(csvText);
  const mapping = detectColumns(columns);
  const balances = new Map();

  for (const row of rows) {
    const workDate = parseDate(cell(row, mapping.date));
    if (startDate && (!workDate || workDate < startDate)) continue;

    const cleanerName = normalizeCleanerName(cell(row, mapping.employee));
    if (!cleanerName) continue;

    const minutes = toNumber(firstNonEmpty(row, mapping.minuteColumns));
    const purchases = toNumber(cell(row, mapping.purchases));
    const linenUnits = toNumber(cell(row, mapping.linen));
    const current = getBalance(balances, cleanerName);

    current.total_minutes += minutes;
    current.total_hours += minutes / 60;
    current.labor_due += (minutes / 60) * hourlyRate;
    current.linen_due += linenUnits * linenRate;
    current.purchases_due += purchases;
    current.sheet_rows += 1;
  }

  for (const payment of payments) {
    const paymentDate = parseDate(payment.payment_date);
    if (isSettlementPayment(payment)) continue;
    if (startDate && (!paymentDate || paymentDate < startDate)) continue;

    const cleanerName = normalizeCleanerName(payment.cleaner_name);
    if (!cleanerName) continue;
    const current = getBalance(balances, cleanerName);
    current.total_paid += toNumber(payment.amount);
    current.payment_count += 1;
  }

  return [...balances.values()]
    .map((item) => {
      const totalDue = item.labor_due + item.linen_due + item.purchases_due;
      return {
        ...item,
        total_due: roundMoney(totalDue),
        total_paid: roundMoney(item.total_paid),
        balance: roundMoney(totalDue - item.total_paid),
      };
    })
    .sort((a, b) => b.balance - a.balance || a.cleaner_name.localeCompare(b.cleaner_name));
}

function getBalance(balances, cleanerName) {
  if (!balances.has(cleanerName)) {
    balances.set(cleanerName, {
      cleaner_name: cleanerName,
      total_minutes: 0,
      total_hours: 0,
      labor_due: 0,
      linen_due: 0,
      purchases_due: 0,
      total_paid: 0,
      sheet_rows: 0,
      payment_count: 0,
    });
  }
  return balances.get(cleanerName);
}

function detectColumns(columns) {
  return {
    date: exact(columns, "Horodateur") || find(columns, ["horodateur", "date", "timestamp", "jour"]),
    employee: exact(columns, "Quel est ton prénom ?") || find(columns, ["prenom", "salarié", "salarie", "employé", "employee", "prestataire"]),
    minuteColumns: findAll(columns, ["temps passe sur la prestation", "temps passé sur la prestation", "minutes"]),
    purchases: exact(columns, "Montant Achats") || find(columns, ["montant achats", "montant achat"]),
    linen: exact(columns, "Combien de paires de draps as-tu nettoyées ?") || find(columns, ["combien de paires", "paires de draps", "jeux nettoy", "linge nettoy", "lots nettoy"]),
  };
}

function isSettlementPayment(payment) {
  const note = normalize(payment.note);
  return /(^|\s)(solde|soldee|soldees|soldes)(\s|$)/.test(note);
}

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : parseDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);
  const raw = String(value).trim();
  const french = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (french) {
    const year = french[3].length === 2 ? `20${french[3]}` : french[3];
    const date = new Date(Number(year), Number(french[2]) - 1, Number(french[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCleanerName(value) {
  const name = String(value || "").trim();
  if (!name || normalize(name) === "non renseigne") return "";
  const normalized = normalize(name);
  if (normalized.includes("jennifer")) return "Jennifer";
  if (normalized.includes("rachida")) return "Rachida";
  if (normalized.includes("gaelle")) return "Gaelle";
  return name.replace(/\s+/g, " ");
}

function parseCsvMatrix(csvText) {
  const lines = [];
  let current = "";
  let row = [];
  let quoted = false;
  const text = String(csvText || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      if (current || row.length) lines.push([...row, current]);
      current = "";
      row = [];
    } else {
      current += char;
    }
  }
  if (current || row.length) lines.push([...row, current]);
  return lines;
}

function makeUniqueColumns(headers) {
  const seen = new Map();
  return headers.map((header, index) => {
    const base = String(header || "").trim() || `Colonne ${index + 1}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} __${count}`;
  });
}

function firstNonEmpty(row, columns) {
  for (const column of columns || []) {
    if (String(cell(row, column)).trim()) return cell(row, column);
  }
  return "";
}

function cell(row, column) {
  return column ? row[column] || "" : "";
}

function exact(columns, name) {
  return columns.find((column) => normalize(column) === normalize(name));
}

function find(columns, keywords) {
  return findAll(columns, keywords)[0];
}

function findAll(columns, keywords) {
  const needles = keywords.map(normalize);
  return columns.filter((column) => needles.some((needle) => normalize(column).includes(needle)));
}

function normalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toNumber(value) {
  const cleaned = String(value ?? "").replace(/\s/g, "").replace(/€/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
