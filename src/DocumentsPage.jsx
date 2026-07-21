import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectFolder(doc) {
  const text = normalize(`${doc.file_name || ""} ${doc.file_path || ""} ${doc.category || ""} ${doc.supplier || ""} ${doc.summary || ""}`);

  if (text.includes("relevecompte") || text.includes("00050824435")) return ["Banque", "Crédit Agricole", "🏦"];
  if (text.includes("cchq") || text.includes("16376791508")) return ["Banque", "Banque Populaire", "🏦"];
  if (text.includes("31398321960") || text.includes("extrait de compte")) return ["Banque", "BoursoBank", "🏦"];
  if (text.includes("bforbank") || text.includes("releve mensuel de compte bancaire")) return ["Banque", "BforBank", "🏦"];
  if (text.includes("american express") || text.includes("amex") || text.match(/2026 0[1-5] 11/)) return ["Banque", "American Express", "💳"];
  if (text.includes("societe generale") || text.includes("credit du nord")) return ["Banque", "Société Générale", "🏦"];

  if (text.includes("airbnb") || text.includes("earnings")) return ["Airbnb", "Rapports Airbnb", "🏠"];

  if (text.includes("willaert") || text.includes("fa2026")) return ["Factures fournisseurs", "Willaert", "🧾"];
  if (text.includes("floris") || text.includes("agora") || text.includes("flf")) return ["Factures fournisseurs", "Floris / Agora", "🧾"];

  if (text.includes("nettoyage") || text.includes("menage") || text.includes("jennifer") || text.includes("melezio")) return ["Ménage", "Jennifer / Excel", "🧹"];
  if (text.includes("rachida")) return ["Ménage", "Rachida / papiers", "🧹"];
  if (text.includes("gaelle")) return ["Ménage", "Gaelle", "🧹"];
  if (text.includes(".jpg") || text.includes(".jpeg") || text.includes(".png")) return ["Ménage", "Photos / papiers à classer", "🖼️"];

  if (text.includes("ventes") || text.includes("vegetaux") || text.includes("plantes")) return ["Ventes plantes", "Tableaux ventes", "🌿"];

  return ["À classer", "Autres documents", "❓"];
}

function expectedFolder(req) {
  const source = normalize(req.expected_source || "");
  const family = req.document_family || "";

  if (source.includes("credit agricole")) return ["Banque", "Crédit Agricole"];
  if (source.includes("banque populaire")) return ["Banque", "Banque Populaire"];
  if (source.includes("boursobank")) return ["Banque", "BoursoBank"];
  if (source.includes("bforbank")) return ["Banque", "BforBank"];
  if (source.includes("american express")) return ["Banque", "American Express"];
  if (source.includes("societe generale")) return ["Banque", "Société Générale"];

  if (source.includes("airbnb")) return ["Airbnb", "Rapports Airbnb"];
  if (source.includes("willaert")) return ["Factures fournisseurs", "Willaert"];
  if (source.includes("floris") || source.includes("agora")) return ["Factures fournisseurs", "Floris / Agora"];
  if (source.includes("jennifer")) return ["Ménage", "Jennifer / Excel"];
  if (source.includes("rachida")) return ["Ménage", "Rachida / papiers"];
  if (source.includes("gaelle")) return ["Ménage", "Gaelle"];
  if (source.includes("ventes plantes")) return ["Ventes plantes", "Tableaux ventes"];

  if (family === "bank_statement") return ["Banque", "Autres banques"];
  return ["À classer", "Autres documents"];
}

function periodTokens(period = "") {
  if (!period || String(period).includes("_")) return [];
  const [year, month] = String(period).split("-");
  return [period, period.replace("-", ""), year, month].filter(Boolean).map(normalize);
}

function sourceTokens(source = "") {
  const s = normalize(source);
  if (s.includes("credit agricole")) return ["relevecompte", "00050824435"];
  if (s.includes("banque populaire")) return ["cchq", "16376791508"];
  if (s.includes("boursobank")) return ["31398321960", "extrait de compte"];
  if (s.includes("bforbank")) return ["bforbank", "releve mensuel de compte bancaire"];
  if (s.includes("american express")) return ["american express", "amex", "2026-01-11", "2026-02-11", "2026-03-11", "2026-04-11", "2026-05-11"];
  if (s.includes("societe generale")) return ["societe generale", "credit du nord"];
  if (s.includes("willaert")) return ["willaert", "fa2026"];
  if (s.includes("floris") || s.includes("agora")) return ["floris", "agora", "flf"];
  if (s.includes("airbnb")) return ["airbnb", "earnings"];
  if (s.includes("jennifer")) return ["nettoyage", "menage", "melezio"];
  if (s.includes("rachida")) return ["rachida"];
  if (s.includes("gaelle")) return ["gaelle"];
  if (s.includes("ventes plantes")) return ["ventes", "vegetaux", "plantes"];
  return [s].filter(Boolean);
}

function isRequirementFound(req, docs) {
  const tokens = sourceTokens(req.expected_source);
  const pTokens = periodTokens(req.expected_period);

  return docs.some((doc) => {
    const haystack = normalize(`${doc.file_name || ""} ${doc.file_path || ""} ${doc.summary || ""} ${doc.category || ""} ${doc.supplier || ""}`);
    const sourceOk = tokens.some((token) => haystack.includes(normalize(token)));
    if (!sourceOk) return false;
    if (!pTokens.length) return true;
    return pTokens.some((token) => haystack.includes(token));
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    const [docsRes, reqRes] = await Promise.all([
      supabase
        .from("documents")
        .select("id, file_name, file_path, file_type, source, category, supplier, property, summary, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("document_requirements")
        .select("id, document_family, expected_source, expected_period, expected_label, is_required")
        .order("document_family", { ascending: true }),
    ]);

    if (docsRes.error) console.warn(docsRes.error);
    if (reqRes.error) console.warn(reqRes.error);

    setDocuments(docsRes.data || []);
    setRequirements(reqRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const enrichedRequirements = useMemo(() => {
    return requirements.map((req) => {
      const [family, sub] = expectedFolder(req);
      return {
        ...req,
        family,
        sub,
        found: isRequirementFound(req, documents),
      };
    });
  }, [requirements, documents]);

  const cards = useMemo(() => {
    const map = {};

    documents.forEach((doc) => {
      const [family, sub, icon] = detectFolder(doc);
      const key = `${family}|||${sub}`;
      if (!map[key]) {
        map[key] = { key, family, sub, icon, docs: [], missing: [] };
      }
      map[key].docs.push(doc);
    });

    enrichedRequirements.forEach((req) => {
      const key = `${req.family}|||${req.sub}`;
      if (!map[key]) {
        map[key] = { key, family: req.family, sub: req.sub, icon: iconForFamily(req.family), docs: [], missing: [] };
      }
      if (req.is_required && !req.found) {
        map[key].missing.push(req);
      }
    });

    const order = ["Banque", "Airbnb", "Factures fournisseurs", "Ménage", "Ventes plantes", "À classer"];

    return Object.values(map).sort((a, b) => {
      const f = order.indexOf(a.family) - order.indexOf(b.family);
      if (f !== 0) return f;
      return a.sub.localeCompare(b.sub);
    });
  }, [documents, enrichedRequirements]);

  const families = useMemo(() => {
    return cards.reduce((acc, card) => {
      if (!acc[card.family]) acc[card.family] = [];
      acc[card.family].push(card);
      return acc;
    }, {});
  }, [cards]);

  const totalMissing = enrichedRequirements.filter((r) => r.is_required && !r.found).length;
  const foundRequirements = enrichedRequirements.filter((r) => r.found).length;

  return (
    <main style={styles.page}>
      <header style={styles.hero}>
        <div>
          <div style={styles.smallLabel}>TIBALDO OS</div>
          <h1 style={styles.h1}>Documents</h1>
          <p style={styles.subtitle}>
            Coffre documentaire organisé par dossiers intelligents.
          </p>
        </div>

        <button onClick={load} style={styles.refreshButton}>
          Rafraîchir
        </button>
      </header>

      <section style={styles.kpiGrid}>
        <Kpi icon="📁" label="Documents" value={documents.length} />
        <Kpi icon="✅" label="Attendus trouvés" value={foundRequirements} />
        <Kpi icon="⚠️" label="Manquants" value={totalMissing} warning />
        <Kpi icon="📦" label="Dossiers" value={cards.length} />
      </section>

      {loading ? (
        <section style={styles.panel}>Chargement...</section>
      ) : (
        <section style={styles.families}>
          {Object.entries(families).map(([family, familyCards]) => (
            <div key={family} style={styles.familyPanel}>
              <div style={styles.familyHeader}>
                <h2 style={styles.familyTitle}>{family}</h2>
                <span style={styles.familyCount}>
                  {familyCards.reduce((sum, card) => sum + card.docs.length, 0)} fichier(s)
                </span>
              </div>

              <div style={styles.cardGrid}>
                {familyCards.map((card) => (
                  <button
                    key={card.key}
                    style={{
                      ...styles.folderCard,
                      borderColor: card.missing.length ? "#fed7aa" : "#dbeafe",
                      background: card.missing.length ? "#fff7ed" : "#f8fafc",
                    }}
                    onClick={() => setSelected(card)}
                  >
                    <div style={styles.iconBubble}>{card.icon}</div>

                    <div style={styles.cardText}>
                      <strong style={styles.cardTitle}>{card.sub}</strong>
                      <span style={styles.cardMeta}>
                        {card.docs.length} fichier(s)
                      </span>

                      {card.missing.length ? (
                        <span style={styles.missingBadge}>
                          {card.missing.length} manquant(s)
                        </span>
                      ) : (
                        <span style={styles.okBadge}>OK</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {selected && (
        <div style={styles.overlay} onClick={() => setSelected(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{selected.icon} {selected.sub}</h2>
                <p style={styles.subtitle}>
                  {selected.docs.length} fichier(s) · {selected.missing.length} manquant(s)
                </p>
              </div>

              <button onClick={() => setSelected(null)} style={styles.closeButton}>✕</button>
            </div>

            {selected.missing.length > 0 && (
              <div style={styles.missingBox}>
                <strong>Documents manquants</strong>
                <div style={styles.chipGrid}>
                  {selected.missing.map((req) => (
                    <span key={req.id} style={styles.missingChip}>
                      {req.expected_period || "—"} · {req.expected_label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.modalGrid}>
              {selected.docs.map((doc) => (
                <div key={doc.id} style={styles.docMiniCard}>
                  <strong style={styles.docName}>{doc.file_name}</strong>
                  <span style={styles.docMeta}>
                    {doc.category || "Non classé"} · {formatDate(doc.created_at)}
                  </span>

                  {doc.file_path && (
                    <button
                      style={styles.openButton}
                      onClick={async () => {
                        const { data, error } = await supabase.storage
                          .from("tibaldo-documents")
                          .createSignedUrl(doc.file_path, 60 * 5);

                        if (error) {
                          alert("Impossible d’ouvrir le fichier.");
                          return;
                        }

                        window.open(data.signedUrl, "_blank");
                      }}
                    >
                      Ouvrir
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function iconForFamily(family) {
  if (family === "Banque") return "🏦";
  if (family === "Airbnb") return "🏠";
  if (family === "Factures fournisseurs") return "🧾";
  if (family === "Ménage") return "🧹";
  if (family === "Ventes plantes") return "🌿";
  return "❓";
}

function Kpi({ icon, label, value, warning }) {
  return (
    <div style={{ ...styles.kpi, background: warning ? "#fff7ed" : "white" }}>
      <div style={styles.kpiIcon}>{icon}</div>
      <div>
        <div style={{ ...styles.kpiValue, color: warning ? "#c2410c" : "#0f766e" }}>{value}</div>
        <div style={styles.kpiLabel}>{label}</div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    width: "min(1180px, calc(100% - 28px))",
    margin: "0 auto",
    padding: "24px 0 100px",
  },
  hero: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: 22,
    borderRadius: 28,
    background: "white",
    boxShadow: "0 10px 30px rgba(15,23,42,.06)",
    marginBottom: 18,
  },
  smallLabel: {
    fontSize: 12,
    letterSpacing: ".16em",
    fontWeight: 900,
    color: "#64748b",
  },
  h1: {
    margin: "4px 0 0",
    fontSize: 34,
    color: "#0f172a",
    lineHeight: 1,
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
  },
  refreshButton: {
    border: "none",
    borderRadius: 16,
    padding: "11px 15px",
    background: "#f1f5f9",
    color: "#334155",
    fontWeight: 900,
    cursor: "pointer",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },
  kpi: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderRadius: 22,
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 20px rgba(15,23,42,.04)",
  },
  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    background: "#f8fafc",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: 950,
    lineHeight: 1,
  },
  kpiLabel: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },
  panel: {
    padding: 20,
    borderRadius: 24,
    background: "white",
  },
  families: {
    display: "grid",
    gap: 16,
  },
  familyPanel: {
    padding: 18,
    borderRadius: 26,
    background: "white",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 26px rgba(15,23,42,.05)",
  },
  familyHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  familyTitle: {
    margin: 0,
    fontSize: 20,
    color: "#0f172a",
  },
  familyCount: {
    color: "#64748b",
    fontWeight: 800,
    fontSize: 13,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
    gap: 10,
  },
  folderCard: {
    minHeight: 128,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    textAlign: "left",
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 15,
    background: "white",
    display: "grid",
    placeItems: "center",
    fontSize: 23,
    boxShadow: "0 5px 14px rgba(15,23,42,.06)",
  },
  cardText: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.15,
  },
  cardMeta: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
  okBadge: {
    width: "fit-content",
    borderRadius: 999,
    padding: "5px 8px",
    background: "#ecfdf5",
    color: "#047857",
    fontSize: 11,
    fontWeight: 950,
  },
  missingBadge: {
    width: "fit-content",
    borderRadius: 999,
    padding: "5px 8px",
    background: "#ffedd5",
    color: "#c2410c",
    fontSize: 11,
    fontWeight: 950,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.45)",
    zIndex: 10030,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    width: "min(900px, 100%)",
    maxHeight: "86vh",
    overflow: "auto",
    background: "white",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 24px 80px rgba(0,0,0,.28)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16,
  },
  modalTitle: {
    margin: 0,
    color: "#0f172a",
  },
  closeButton: {
    border: "none",
    width: 44,
    height: 44,
    borderRadius: 16,
    background: "#f1f5f9",
    fontSize: 18,
    cursor: "pointer",
  },
  missingBox: {
    padding: 14,
    borderRadius: 20,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    marginBottom: 16,
    color: "#9a3412",
  },
  chipGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  missingChip: {
    borderRadius: 999,
    background: "white",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
  modalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  docMiniCard: {
    padding: 13,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 8,
  },
  docName: {
    color: "#0f172a",
    fontSize: 13,
    wordBreak: "break-word",
  },
  docMeta: {
    color: "#64748b",
    fontSize: 12,
  },
  openButton: {
    justifySelf: "start",
    border: "none",
    borderRadius: 12,
    background: "#0f766e",
    color: "white",
    padding: "8px 11px",
    fontWeight: 900,
    cursor: "pointer",
  },
};
