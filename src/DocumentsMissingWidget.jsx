import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function periodTokens(period = "") {
  if (!period || String(period).includes("_")) return [];
  const [year, month] = String(period).split("-");
  return [period, period.replace("-", ""), year, month].filter(Boolean).map(normalizeText);
}

function sourceTokens(source = "") {
  const s = normalizeText(source);

  if (s.includes("credit agricole")) return ["credit agricole", "relevecompte", "00050824435"];
  if (s.includes("banque populaire")) return ["banque populaire", "cchq", "16376791508"];
  if (s.includes("boursobank")) return ["boursobank", "bourso", "extrait de compte 31398321960"];
  if (s.includes("bforbank")) return ["bforbank", "releve mensuel de compte bancaire"];
  if (s.includes("societe generale")) return ["societe generale", "credit du nord", "00050824435"];
  if (s.includes("american express")) return ["american express", "amex", "2026-01-11", "2026-02-11", "2026-03-11", "2026-04-11", "2026-05-11"];
  if (s.includes("willaert")) return ["willaert", "fa2026"];
  if (s.includes("floris") || s.includes("agora")) return ["floris", "agora", "flf"];
  if (s.includes("airbnb")) return ["airbnb"];
  if (s.includes("jennifer")) return ["jennifer", "nettoyage", "menage", "melezio"];
  if (s.includes("rachida")) return ["rachida", ".jpg", ".jpeg"];
  if (s.includes("gaelle")) return ["gaelle", "formulaire", "housekeeping"];
  if (s.includes("ventes plantes")) return ["ventes", "tibaldo", "vegetaux", "plantes"];

  return [s].filter(Boolean);
}

function isFound(req, documents) {
  const tokens = sourceTokens(req.expected_source);
  const pTokens = periodTokens(req.expected_period);

  return documents.some((doc) => {
    const haystack = normalizeText(`${doc.file_name || ""} ${doc.summary || ""} ${doc.source || ""}`);

    const sourceOk = tokens.some((token) => haystack.includes(normalizeText(token)));
    if (!sourceOk) return false;

    if (!pTokens.length) return true;

    return pTokens.some((token) => haystack.includes(token));
  });
}

function familyLabel(value) {
  const labels = {
    bank_statement: "Banques",
    airbnb_report: "Airbnb",
    supplier_invoice: "Fournisseurs",
    housekeeping_payroll: "Ménage",
    sales_report: "Ventes",
  };
  return labels[value] || value || "Autres";
}

function statusColor(row) {
  if (row.found) return { bg: "#ecfdf5", color: "#047857", text: "Trouvé" };
  if (row.is_required) return { bg: "#fff7ed", color: "#c2410c", text: "Manquant" };
  return { bg: "#f8fafc", color: "#475569", text: "Optionnel" };
}

export default function DocumentsMissingWidget() {
  const [requirements, setRequirements] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  if (window.location.pathname !== "/documents") return null;

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [reqRes, docRes] = await Promise.all([
        supabase
          .from("document_requirements")
          .select("id, document_family, expected_source, expected_period, expected_label, is_required")
          .order("document_family", { ascending: true })
          .order("expected_source", { ascending: true })
          .order("expected_period", { ascending: true }),
        supabase
          .from("documents")
          .select("id, file_name, summary, source, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (reqRes.error) console.warn(reqRes.error);
      if (docRes.error) console.warn(docRes.error);

      setRequirements(reqRes.data || []);
      setDocuments(docRes.data || []);
      setLoading(false);
    }

    load();
  }, []);

  const rows = useMemo(() => {
    return requirements.map((req) => ({
      ...req,
      found: isFound(req, documents),
    }));
  }, [requirements, documents]);

  const found = rows.filter((row) => row.found);
  const missingRequired = rows.filter((row) => row.is_required && !row.found);
  const optionalMissing = rows.filter((row) => !row.is_required && !row.found);

  const missingByFamily = useMemo(() => {
    return missingRequired.reduce((acc, row) => {
      const key = familyLabel(row.document_family);
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
  }, [missingRequired]);

  const topMissing = missingRequired.slice(0, 8);

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📌 Point documents</h2>
          <p style={styles.subtitle}>
            Vue simple des fichiers attendus, trouvés et manquants.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          style={styles.refreshButton}
        >
          Rafraîchir
        </button>
      </div>

      <div style={styles.kpis}>
        <Kpi label="Importés" value={documents.length} tone="neutral" />
        <Kpi label="Trouvés" value={found.length} tone="good" />
        <Kpi label="Manquants" value={missingRequired.length} tone="warn" />
      </div>

      {loading ? (
        <p style={styles.loading}>Analyse en cours...</p>
      ) : (
        <>
          {missingRequired.length === 0 ? (
            <div style={styles.successBox}>
              ✅ Aucun document obligatoire manquant.
            </div>
          ) : (
            <div style={styles.block}>
              <h3 style={styles.blockTitle}>À compléter en priorité</h3>

              <div style={styles.shortList}>
                {topMissing.map((row) => (
                  <MissingLine key={row.id} row={row} />
                ))}
              </div>

              {missingRequired.length > topMissing.length && (
                <p style={styles.moreText}>
                  + {missingRequired.length - topMissing.length} autre(s) document(s) à vérifier.
                </p>
              )}
            </div>
          )}

          <details style={styles.details}>
            <summary style={styles.summary}>
              Voir le détail par catégorie
            </summary>

            <div style={styles.groupGrid}>
              {Object.entries(missingByFamily).map(([family, items]) => (
                <div key={family} style={styles.groupCard}>
                  <h4 style={styles.groupTitle}>{family}</h4>
                  {items.length === 0 ? (
                    <p style={styles.emptyText}>Tout est trouvé.</p>
                  ) : (
                    <div style={styles.groupList}>
                      {items.map((row) => (
                        <MissingLine key={row.id} row={row} compact />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {optionalMissing.length > 0 && (
                <div style={styles.groupCard}>
                  <h4 style={styles.groupTitle}>Optionnels</h4>
                  <div style={styles.groupList}>
                    {optionalMissing.map((row) => (
                      <MissingLine key={row.id} row={row} compact />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function Kpi({ label, value, tone }) {
  const colors = {
    good: ["#ecfdf5", "#047857"],
    warn: ["#fff7ed", "#c2410c"],
    neutral: ["#f8fafc", "#334155"],
  };
  const [bg, color] = colors[tone] || colors.neutral;

  return (
    <div style={{ ...styles.kpi, background: bg, color }}>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
    </div>
  );
}

function MissingLine({ row, compact = false }) {
  const status = statusColor(row);

  return (
    <div style={compact ? styles.lineCompact : styles.line}>
      <span style={{ ...styles.badge, background: status.bg, color: status.color }}>
        {status.text}
      </span>

      <div style={styles.lineContent}>
        <strong style={styles.lineTitle}>{row.expected_label}</strong>
        <span style={styles.lineMeta}>
          {row.expected_source}
          {row.expected_period ? ` · ${row.expected_period}` : ""}
        </span>
      </div>
    </div>
  );
}

const styles = {
  card: {
    maxWidth: 1100,
    margin: "24px auto",
    padding: 20,
    borderRadius: 24,
    background: "white",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 28px rgba(15,23,42,.07)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 24,
    color: "#0f172a",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
  },
  refreshButton: {
    border: "none",
    borderRadius: 14,
    padding: "10px 14px",
    background: "#f1f5f9",
    color: "#334155",
    fontWeight: 800,
    cursor: "pointer",
  },
  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  kpi: {
    borderRadius: 18,
    padding: 16,
    textAlign: "center",
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: 950,
    lineHeight: 1,
  },
  kpiLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: 800,
  },
  loading: {
    color: "#64748b",
  },
  successBox: {
    padding: 14,
    borderRadius: 16,
    background: "#ecfdf5",
    color: "#047857",
    fontWeight: 850,
  },
  block: {
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  blockTitle: {
    margin: "0 0 10px",
    fontSize: 17,
    color: "#0f172a",
  },
  shortList: {
    display: "grid",
    gap: 8,
  },
  line: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    background: "white",
    border: "1px solid #e2e8f0",
  },
  lineCompact: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 0",
    borderBottom: "1px solid #eef2f7",
  },
  badge: {
    flexShrink: 0,
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 900,
  },
  lineContent: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },
  lineTitle: {
    color: "#0f172a",
    fontSize: 14,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  lineMeta: {
    color: "#64748b",
    fontSize: 12,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  moreText: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
  },
  details: {
    marginTop: 14,
  },
  summary: {
    cursor: "pointer",
    color: "#0f766e",
    fontWeight: 900,
  },
  groupGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  groupCard: {
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  groupTitle: {
    margin: "0 0 8px",
    color: "#0f172a",
  },
  groupList: {
    display: "grid",
  },
  emptyText: {
    color: "#64748b",
    margin: 0,
  },
};
