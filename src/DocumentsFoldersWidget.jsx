import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ");
}

function detectFolder(doc) {
  const text = normalize(`${doc.file_name || ""} ${doc.file_path || ""} ${doc.category || ""} ${doc.supplier || ""} ${doc.summary || ""}`);

  if (text.includes("credit agricole") || text.includes("relevecompte") || text.includes("00050824435")) {
    return { family: "Banque", sub: "Crédit Agricole", icon: "🏦" };
  }

  if (text.includes("bforbank") || text.includes("releve mensuel de compte bancaire")) {
    return { family: "Banque", sub: "BforBank", icon: "🏦" };
  }

  if (text.includes("boursobank") || text.includes("31398321960") || text.includes("extrait de compte")) {
    return { family: "Banque", sub: "BoursoBank", icon: "🏦" };
  }

  if (text.includes("banque populaire") || text.includes("cchq") || text.includes("16376791508")) {
    return { family: "Banque", sub: "Banque Populaire", icon: "🏦" };
  }

  if (text.includes("american express") || text.includes("amex") || text.match(/2026 0[1-5] 11/)) {
    return { family: "Banque", sub: "American Express", icon: "💳" };
  }

  if (text.includes("societe generale") || text.includes("credit du nord")) {
    return { family: "Banque", sub: "Société Générale", icon: "🏦" };
  }

  if (text.includes("airbnb") || text.includes("earnings")) {
    return { family: "Airbnb", sub: "Rapports Airbnb", icon: "🏠" };
  }

  if (text.includes("willaert") || text.includes("fa2026")) {
    return { family: "Factures fournisseurs", sub: "Willaert", icon: "🧾" };
  }

  if (text.includes("floris") || text.includes("agora") || text.includes("flf")) {
    return { family: "Factures fournisseurs", sub: "Floris / Agora", icon: "🧾" };
  }

  if (text.includes("nettoyage") || text.includes("menage") || text.includes("jennifer") || text.includes("melezio")) {
    return { family: "Ménage", sub: "Jennifer / Excel", icon: "🧹" };
  }

  if (text.includes("rachida")) {
    return { family: "Ménage", sub: "Rachida / papiers", icon: "🧹" };
  }

  if (text.includes("gaelle")) {
    return { family: "Ménage", sub: "Gaelle", icon: "🧹" };
  }

  if (text.includes("ventes") || text.includes("vegetaux") || text.includes("plantes")) {
    return { family: "Ventes plantes", sub: "Tableaux ventes", icon: "🌿" };
  }

  if (text.includes(".jpg") || text.includes(".jpeg") || text.includes(".png")) {
    return { family: "À classer", sub: "Photos à classer", icon: "🖼️" };
  }

  return { family: "À classer", sub: "Autres documents", icon: "❓" };
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

export default function DocumentsFoldersWidget() {
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  if (window.location.pathname !== "/documents") return null;

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, file_path, file_type, source, category, supplier, property, summary, created_at")
        .order("created_at", { ascending: false });

      if (error) console.warn(error);
      setDocuments(data || []);
      setLoading(false);
    }

    load();
  }, []);

  const groups = useMemo(() => {
    const map = {};

    for (const doc of documents) {
      const folder = detectFolder(doc);
      const key = `${folder.family}|||${folder.sub}`;

      if (!map[key]) {
        map[key] = {
          ...folder,
          key,
          docs: [],
        };
      }

      map[key].docs.push(doc);
    }

    return Object.values(map).sort((a, b) => {
      const order = ["Banque", "Airbnb", "Factures fournisseurs", "Ménage", "Ventes plantes", "À classer"];
      const familyDiff = order.indexOf(a.family) - order.indexOf(b.family);
      if (familyDiff !== 0) return familyDiff;
      return a.sub.localeCompare(b.sub);
    });
  }, [documents]);

  const families = useMemo(() => {
    return groups.reduce((acc, group) => {
      if (!acc[group.family]) acc[group.family] = [];
      acc[group.family].push(group);
      return acc;
    }, {});
  }, [groups]);

  return (
    <section style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📂 Dossiers intelligents</h2>
          <p style={styles.subtitle}>
            Documents regroupés automatiquement par banque, fournisseur ou activité.
          </p>
        </div>

        <div style={styles.totalBadge}>{documents.length} fichiers</div>
      </div>

      {loading ? (
        <p style={styles.subtitle}>Chargement des dossiers...</p>
      ) : (
        <div style={styles.familyStack}>
          {Object.entries(families).map(([family, items]) => (
            <div key={family} style={styles.familyBlock}>
              <h3 style={styles.familyTitle}>{family}</h3>

              <div style={styles.grid}>
                {items.map((group) => (
                  <button
                    key={group.key}
                    onClick={() => setSelected(group)}
                    style={styles.folderCard}
                  >
                    <div style={styles.folderIcon}>{group.icon}</div>

                    <div style={styles.folderContent}>
                      <strong style={styles.folderTitle}>{group.sub}</strong>
                      <span style={styles.folderMeta}>
                        {group.docs.length} document{group.docs.length > 1 ? "s" : ""}
                      </span>
                      <span style={styles.folderDate}>
                        Dernier import : {formatDate(group.docs[0]?.created_at)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={styles.modalOverlay} onClick={() => setSelected(null)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {selected.icon} {selected.sub}
                </h2>
                <p style={styles.subtitle}>
                  {selected.docs.length} document{selected.docs.length > 1 ? "s" : ""} dans ce dossier.
                </p>
              </div>

              <button onClick={() => setSelected(null)} style={styles.closeButton}>
                ✕
              </button>
            </div>

            <div style={styles.docList}>
              {selected.docs.map((doc) => (
                <div key={doc.id} style={styles.docLine}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={styles.docName}>{doc.file_name}</strong>
                    <div style={styles.docMeta}>
                      {doc.category || "Non classé"} · {doc.supplier || "Sans source"} · {formatDate(doc.created_at)}
                    </div>
                  </div>

                  {doc.file_path ? (
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
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const styles = {
  wrapper: {
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
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 18,
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
  totalBadge: {
    borderRadius: 999,
    background: "#f0fdfa",
    color: "#0f766e",
    padding: "9px 13px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  familyStack: {
    display: "grid",
    gap: 20,
  },
  familyBlock: {
    display: "grid",
    gap: 10,
  },
  familyTitle: {
    margin: 0,
    fontSize: 16,
    color: "#334155",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  folderCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#f8fafc",
    cursor: "pointer",
  },
  folderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "white",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
    boxShadow: "0 4px 12px rgba(15,23,42,.06)",
    flexShrink: 0,
  },
  folderContent: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },
  folderTitle: {
    color: "#0f172a",
    fontSize: 15,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  folderMeta: {
    color: "#0f766e",
    fontWeight: 850,
    fontSize: 13,
  },
  folderDate: {
    color: "#64748b",
    fontSize: 12,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.45)",
    zIndex: 10020,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    width: "min(760px, 100%)",
    maxHeight: "82vh",
    overflow: "auto",
    background: "white",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 20px 70px rgba(0,0,0,.28)",
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
    borderRadius: 14,
    background: "#f1f5f9",
    width: 42,
    height: 42,
    fontSize: 18,
    cursor: "pointer",
  },
  docList: {
    display: "grid",
    gap: 10,
  },
  docLine: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 12,
    background: "#f8fafc",
  },
  docName: {
    color: "#0f172a",
    fontSize: 14,
    wordBreak: "break-word",
  },
  docMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  openButton: {
    border: "none",
    borderRadius: 12,
    background: "#0f766e",
    color: "white",
    padding: "9px 12px",
    fontWeight: 850,
    cursor: "pointer",
    flexShrink: 0,
  },
};
