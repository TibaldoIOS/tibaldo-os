import { useRef, useState } from "react";
import JSZip from "jszip";
import { supabase } from "./supabaseClient";

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".csv",
  ".xlsx",
  ".xls",
  ".txt",
];

function safeName(name) {
  return name
    .replace(/^.*[\\/]/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getExtension(filename) {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot) : "";
}

function isAcceptedFile(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes("__macosx")) return false;
  if (lower.startsWith(".")) return false;
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function getMimeType(filename) {
  const ext = getExtension(filename);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".csv") return "text/csv";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".xls") return "application/vnd.ms-excel";
  if (ext === ".txt") return "text/plain";
  return "application/octet-stream";
}

function detectStorageFolder(filename) {
  const name = filename
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ");

  if (name.includes("relevecompte") || name.includes("00050824435")) {
    return "banque/credit-agricole";
  }

  if (name.includes("cchq") || name.includes("16376791508")) {
    return "banque/banque-populaire";
  }

  if (name.includes("31398321960") || name.includes("extrait de compte")) {
    return "banque/boursobank";
  }

  if (name.includes("releve mensuel de compte bancaire") || name.includes("bforbank")) {
    return "banque/bforbank";
  }

  if (name.match(/2026-0[1-5]-11/) || name.includes("american") || name.includes("amex")) {
    return "banque/american-express";
  }

  if (name.includes("societe generale") || name.includes("credit du nord")) {
    return "banque/societe-generale";
  }

  if (name.includes("airbnb") || name.includes("earnings")) {
    return "airbnb/rapports";
  }

  if (name.includes("fa2026") || name.includes("willaert")) {
    return "fournisseurs/willaert";
  }

  if (name.includes("flf") || name.includes("floris") || name.includes("agora")) {
    return "fournisseurs/floris-agora";
  }

  if (name.includes("nettoyage") || name.includes("menage") || name.includes("melezio")) {
    return "menage/jennifer";
  }

  if (name.includes("ventes") || name.includes("vegetal") || name.includes("vegetaux") || name.includes("plantes")) {
    return "ventes-plantes";
  }

  if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png")) {
    return "menage/photos-a-classer";
  }

  return "a-classer";
}

function detectDocumentMeta(filename) {
  const folder = detectStorageFolder(filename);

  if (folder.startsWith("banque/")) {
    return { category: "Banque", supplier: folder.replace("banque/", ""), property: "Non concerné" };
  }

  if (folder.startsWith("fournisseurs/")) {
    return { category: "Facture fournisseur", supplier: folder.replace("fournisseurs/", ""), property: "Non concerné" };
  }

  if (folder.startsWith("menage/")) {
    return { category: "Ménage", supplier: folder.replace("menage/", ""), property: "Airbnb" };
  }

  if (folder.startsWith("airbnb/")) {
    return { category: "Airbnb", supplier: "Airbnb", property: "Global Airbnb" };
  }

  if (folder.startsWith("ventes-plantes")) {
    return { category: "Ventes plantes", supplier: "Tibaldo Jungle", property: "Non concerné" };
  }

  return { category: "À classer", supplier: "", property: "Non concerné" };
}

export default function TibaldoZipImportWidget() {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState([]);

  if (window.location.pathname !== "/documents") return null;

  async function importZip(file) {
    setBusy(true);
    setMessage("Lecture du ZIP...");
    setResults([]);

    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((entry) => {
        return !entry.dir && isAcceptedFile(entry.name);
      });

      if (!entries.length) {
        setMessage("Aucun fichier compatible trouvé dans ce ZIP.");
        setBusy(false);
        return;
      }

      const batchId = crypto.randomUUID();
      const imported = [];
      const ignored = [];
      const errors = [];

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const originalName = entry.name;
        const fileName = safeName(originalName);
        const folder = detectStorageFolder(fileName);
        const storagePath = `${folder}/${batchId}/${String(index + 1).padStart(3, "0")}-${fileName}`;
        const meta = detectDocumentMeta(fileName);

        setMessage(`Import ${index + 1}/${entries.length} : ${fileName}`);

        try {
          const blob = await entry.async("blob");
          const mimeType = getMimeType(fileName);
          const uploadFile = new File([blob], fileName, { type: mimeType });

          const { error: uploadError } = await supabase.storage
            .from("tibaldo-documents")
            .upload(storagePath, uploadFile, {
              cacheControl: "3600",
              upsert: true,
              contentType: mimeType,
            });

          if (uploadError) throw uploadError;

          const insertPayload = {
            unique_key: `${batchId}-${index + 1}-${fileName}`,
            file_name: fileName,
            file_path: storagePath,
            file_type: mimeType,
            source: "zip_import",
            category: meta.category,
            supplier: meta.supplier,
            property: meta.property,
            summary: `Import ZIP massif : ${file.name} · Dossier : ${folder}`,
            status: "imported",
          };

          const { error: insertError } = await supabase
            .from("documents")
            .insert(insertPayload);

          if (insertError) throw insertError;

          imported.push(fileName);
        } catch (err) {
          errors.push(`${fileName} — ${err.message || "erreur inconnue"}`);
        }
      }

      setResults([
        `Importés : ${imported.length}`,
        `Ignorés : ${ignored.length}`,
        `Erreurs : ${errors.length}`,
        ...errors.slice(0, 10),
      ]);

      setMessage(
        errors.length
          ? `Import terminé avec ${errors.length} erreur(s).`
          : `Import terminé : ${imported.length} fichier(s) envoyé(s) dans Supabase.`
      );
    } catch (err) {
      setMessage(`Erreur ZIP : ${err.message || "impossible de lire le fichier"}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 24,
          bottom: 92,
          zIndex: 9999,
          border: "none",
          borderRadius: 999,
          padding: "12px 16px",
          background: "#111827",
          color: "white",
          fontWeight: 800,
          boxShadow: "0 12px 30px rgba(0,0,0,.25)",
          cursor: "pointer",
        }}
      >
        📦 Import ZIP
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(15,23,42,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(620px, 100%)",
              background: "white",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 20px 60px rgba(0,0,0,.28)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24 }}>Import massif ZIP</h2>
                <p style={{ marginTop: 8, color: "#64748b" }}>
                  Dépose un ZIP contenant PDF, photos, Excel ou CSV. Les fichiers seront envoyés dans Supabase.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  borderRadius: 12,
                  padding: "8px 12px",
                  height: 38,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".zip"
              disabled={busy}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) importZip(selected);
              }}
              style={{ marginTop: 18 }}
            />

            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 16,
                background: "#f8fafc",
                color: "#334155",
                minHeight: 60,
                whiteSpace: "pre-wrap",
              }}
            >
              {message || "En attente d’un fichier ZIP..."}
            </div>

            {results.length > 0 && (
              <ul style={{ marginTop: 14, color: "#334155" }}>
                {results.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
