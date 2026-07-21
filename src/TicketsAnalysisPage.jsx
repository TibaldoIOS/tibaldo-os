import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function TicketsAnalysisPage() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("contact@tibaldo.fr");
  const [password, setPassword] = useState("");
  const [entries, setEntries] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [purchaseStartDate, setPurchaseStartDate] = useState("");
  const [purchaseEndDate, setPurchaseEndDate] = useState("");
  const [purchaseCategory, setPurchaseCategory] = useState("Toutes");
  const [results, setResults] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tibaldo_ticket_ocr_results") || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("tibaldo_ticket_ocr_results", JSON.stringify(results));
  }, [results]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadEntries();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) loadEntries();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(event) {
    event.preventDefault();
    setMessage("Connexion...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage("Erreur connexion : " + error.message);
      return;
    }

    setMessage("Connecté ✅");
  }

  async function loadEntries() {
    setLoading(true);
    setMessage("Chargement des prestations...");

    const { data, error } = await supabase
      .from("housekeeping_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setMessage("Erreur lecture prestations : " + error.message);
      setLoading(false);
      return;
    }

    setEntries(data || []);
    setMessage(`${data?.length || 0} prestation(s) chargée(s) ✅`);
    setLoading(false);
  }

  async function getSignedUrl(path) {
    const { data, error } = await supabase.storage
      .from("tibaldo-documents")
      .createSignedUrl(path, 3600);

    if (error) throw error;
    return data.signedUrl;
  }

  async function analyzeTicket(entry, path) {
    setAnalyzingId(entry.id);
    setMessage("Analyse OCR du ticket en cours...");

    try {
      const signedUrl = await getSignedUrl(path);
      const response = await fetch(signedUrl);
      const blob = await response.blob();

      let text = "";

      if (blob.type.includes("pdf") || path.toLowerCase().endsWith(".pdf")) {
        text = await extractPdfTextOrOcr(blob);
      } else {
        text = await ocrBlob(blob);
      }

      const analysis = analyzeTicketText(text, Number(entry.purchase_amount || 0));

      setResults((current) => ({
        ...current,
        [entry.id]: {
          ...(current[entry.id] || {}),
          [path]: analysis,
        },
      }));

      setMessage("Ticket analysé ✅");
    } catch (error) {
      setMessage("Erreur OCR : " + error.message);
    }

    setAnalyzingId(null);
  }

  if (!session) {
    return (
      <div className="ticketsApp">
        <div className="loginCard">
          <div className="logo">T</div>
          <p className="eyebrow">Tibaldo OS</p>
          <h1>Analyse tickets</h1>
          <p>Connexion privée pour consulter les prestations et analyser les tickets de caisse.</p>

          <form onSubmit={signIn}>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>

            <label>
              Mot de passe
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>

            <button className="primary">Se connecter</button>
          </form>

          {message && <p className="message">{message}</p>}
        </div>

        <style>{ticketsStyles}</style>
      </div>
    );
  }

  const entriesWithTickets = entries.filter((entry) => (entry.ticket_paths || []).length > 0);
  const entriesWithPurchaseNoTicket = entries.filter(
    (entry) => entry.purchase_done && (!entry.ticket_paths || entry.ticket_paths.length === 0)
  );

  return (
    <div className="ticketsApp">
      <header className="hero">
        <div>
          <p className="eyebrow">Tibaldo OS</p>
          <h1>Prestations & tickets</h1>
          <p>Analyse OCR des tickets envoyés par l’espace prestataire.</p>
        </div>
        <button className="secondary" onClick={loadEntries}>{loading ? "Chargement..." : "Rafraîchir"}</button>
      </header>

      {message && <p className="message">{message}</p>}

      <div className="kpiGrid">
        <Kpi label="Prestations" value={entries.length} icon="🧾" />
        <Kpi label="Avec ticket" value={entriesWithTickets.length} icon="🎫" />
        <Kpi label="Achat sans ticket" value={entriesWithPurchaseNoTicket.length} icon="⚠️" />
        <Kpi label="Analyses OCR" value={Object.keys(results).length} icon="🤖" />
      </div>

      <PurchaseReport
        entries={entries}
        results={results}
        startDate={purchaseStartDate}
        endDate={purchaseEndDate}
        categoryFilter={purchaseCategory}
        setStartDate={setPurchaseStartDate}
        setEndDate={setPurchaseEndDate}
        setCategoryFilter={setPurchaseCategory}
      />

      {entriesWithPurchaseNoTicket.length > 0 && (
        <section className="alertBox">
          <p className="eyebrow">Alertes</p>
          <h2>Achat déclaré sans ticket</h2>
          {entriesWithPurchaseNoTicket.map((entry) => (
            <div className="alertItem" key={entry.id}>
              <strong>{entry.staff_name} · {entry.property || "Sans logement"}</strong>
              <span>{formatDate(entry.created_at)} · {formatCurrency(entry.purchase_amount)}</span>
            </div>
          ))}
        </section>
      )}

      <section className="list">
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            results={results[entry.id] || {}}
            analyzing={analyzingId === entry.id}
            onAnalyze={(path) => analyzeTicket(entry, path)}
            getSignedUrl={getSignedUrl}
          />
        ))}
      </section>

      <style>{ticketsStyles}</style>
    </div>
  );
}



function PurchaseReport({
  entries,
  results,
  startDate,
  endDate,
  categoryFilter,
  setStartDate,
  setEndDate,
  setCategoryFilter,
}) {
  const lines = [];

  entries.forEach((entry) => {
    const entryResults = results[entry.id] || {};

    Object.entries(entryResults).forEach(([path, analysis]) => {
      (analysis.productLines || []).forEach((line) => {
        const cleanLabel = cleanTicketProductLabel(line.label);
        const normalized = normalizeOcrLabel(cleanLabel);

        // Nettoyage à l'affichage, même pour les anciennes analyses OCR stockées
        if (!cleanLabel || isNonProductTicketLine(normalized)) return;

        const lineDate = normalizeTicketDate(analysis.detectedDate) || normalizeEntryDate(entry.created_at);
        const fixedCategory = classifyTicketProduct(cleanLabel);

        lines.push({
          entry,
          path,
          label: cleanLabel,
          amount: Number(line.amount || 0),
          category: fixedCategory,
          store: analysis.store || "—",
          date: lineDate,
          displayDate: analysis.detectedDate || formatDate(entry.created_at),
        });
      });
    });
  });

  const categories = ["Toutes", ...Array.from(new Set(lines.map((line) => line.category))).sort()];

  const filteredLines = lines.filter((line) => {
    if (categoryFilter !== "Toutes" && line.category !== categoryFilter) return false;
    if (startDate && line.date && line.date < startDate) return false;
    if (endDate && line.date && line.date > endDate) return false;
    return true;
  });

  const familyRows = Object.entries(
    filteredLines.reduce((acc, line) => {
      if (!acc[line.category]) {
        acc[line.category] = {
          category: line.category,
          count: 0,
          total: 0,
          articles: {},
        };
      }

      acc[line.category].count += 1;
      acc[line.category].total += line.amount;

      const articleKey = normalizeDisplayArticle(line.label);
      if (!acc[line.category].articles[articleKey]) {
        acc[line.category].articles[articleKey] = {
          label: articleKey,
          count: 0,
          total: 0,
        };
      }

      acc[line.category].articles[articleKey].count += 1;
      acc[line.category].articles[articleKey].total += line.amount;

      return acc;
    }, {})
  )
    .map(([, value]) => value)
    .sort((a, b) => b.total - a.total);

  const total = filteredLines.reduce((sum, line) => sum + line.amount, 0);

  if (!lines.length) return null;

  return (
    <section className="purchaseReport">
      <p className="eyebrow">Reporting achats</p>
      <h2>Suivi des articles achetés</h2>

      <div className="purchaseFilters">
        <label>
          Date début
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>

        <label>
          Date fin
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>

        <label>
          Famille
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="purchaseReportKpis">
        <div>
          <span>Articles filtrés</span>
          <strong>{filteredLines.length}</strong>
        </div>
        <div>
          <span>Total filtré</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <div>
          <span>Familles</span>
          <strong>{familyRows.length}</strong>
        </div>
      </div>

      <div className="familyReport">
        {familyRows.map((family) => (
          <details className="familyCard" key={family.category} open>
            <summary>
              <span>{family.category}</span>
              <strong>{family.count} article(s) · {formatCurrency(family.total)}</strong>
            </summary>

            <div className="familyArticles">
              {Object.values(family.articles)
                .sort((a, b) => b.total - a.total)
                .map((article) => (
                  <div className="familyArticle" key={article.label}>
                    <span>{article.label}</span>
                    <strong>{article.count} × · {formatCurrency(article.total)}</strong>
                  </div>
                ))}
            </div>
          </details>
        ))}
      </div>

      <div className="purchaseTableWrap">
        <table className="purchaseTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Salariée</th>
              <th>Enseigne</th>
              <th>Article</th>
              <th>Famille</th>
              <th>Prix</th>
            </tr>
          </thead>

          <tbody>
            {filteredLines.map((line, index) => (
              <tr key={`${line.path}-${index}`}>
                <td>{line.displayDate}</td>
                <td>{line.entry.staff_name}</td>
                <td>{line.store}</td>
                <td>{line.label}</td>
                <td>{line.category}</td>
                <td>{formatCurrency(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function normalizeEntryDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function normalizeTicketDate(value) {
  const raw = String(value || "").trim();

  const numeric = raw.match(/\b([0-3]?\d)[\/-]([01]?\d)[\/-](\d{2,4})\b/);
  if (numeric) {
    const day = numeric[1].padStart(2, "0");
    const month = numeric[2].padStart(2, "0");
    const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];
    return `${year}-${month}-${day}`;
  }

  return "";
}

function normalizeDisplayArticle(label) {
  return String(label || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}


function EntryCard({ entry, results, analyzing, onAnalyze, getSignedUrl }) {
  const [open, setOpen] = useState(false);

  const serviceLabel =
    entry.service_type === "menage"
      ? "Ménage Airbnb"
      : entry.service_type === "linge"
      ? "Linge / draps"
      : entry.service_type === "service_client"
      ? "Service client"
      : entry.service_type === "achat"
      ? "Achat uniquement"
      : entry.service_type;

  const isMenage = entry.service_type === "menage";
  const isLinge = entry.service_type === "linge";
  const isServiceClient = entry.service_type === "service_client";
  const isAchat = entry.service_type === "achat";

  return (
    <article className="entryCard">
      <div className="entryTop" onClick={() => setOpen(!open)}>
        <div>
          <p className="eyebrow">{serviceLabel}</p>
          <h2>{entry.staff_name}{entry.property ? ` · ${entry.property}` : ""}</h2>
          <p>
            {formatDate(entry.created_at)}
            {entry.minutes ? ` · ${entry.minutes} min` : ""}
            {entry.purchase_done ? ` · Achat ${formatCurrency(entry.purchase_amount)}` : ""}
          </p>
        </div>
        <button className="roundButton">{open ? "−" : "+"}</button>
      </div>

      {open && (
        <div className="entryDetails">
          {isServiceClient && (
            <div className="detailGrid">
              <span>Mission</span>
              <strong>{entry.mission_description || "—"}</strong>

              <span>Temps passé</span>
              <strong>{entry.minutes ? `${entry.minutes} min` : "—"}</strong>
            </div>
          )}

          {isLinge && (
            <div className="detailGrid">
              <span>Paires de draps</span>
              <strong>{entry.linen_pairs || "—"}</strong>
            </div>
          )}

          {isAchat && (
            <>
              <div className="detailGrid">
                <span>Produits déclarés</span>
                <strong>{[...(entry.purchased_products || []), entry.purchase_products_other].filter(Boolean).join(", ") || "—"}</strong>

                <span>Montant déclaré</span>
                <strong>{formatCurrency(entry.purchase_amount)}</strong>

                <span>Logement</span>
                <strong>{entry.property || "Non concerné"}</strong>

                <span>Remarque</span>
                <strong>{entry.remarks || "—"}</strong>
              </div>

              {(entry.ticket_paths || []).length === 0 ? (
                <div className="warning">⚠️ Achat déclaré mais aucun ticket envoyé.</div>
              ) : (
                <div className="ticketsList">
                  {(entry.ticket_paths || []).map((path) => (
                    <TicketBlock
                      key={path}
                      path={path}
                      result={results[path]}
                      analyzing={analyzing}
                      onAnalyze={() => onAnalyze(path)}
                      getSignedUrl={getSignedUrl}
                      declaredAmount={Number(entry.purchase_amount || 0)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {isMenage && (
            <>
              <div className="detailGrid">
                <span>Produits déclarés</span>
                <strong>{[...(entry.purchased_products || []), entry.purchase_products_other].filter(Boolean).join(", ") || "—"}</strong>

                <span>Chambres</span>
                <strong>{(entry.rooms || []).join(", ") || "—"}</strong>

                <span>Surfaces</span>
                <strong>{(entry.surfaces || []).join(", ") || "—"}</strong>

                <span>Remarques</span>
                <strong>{entry.remarks || "—"}</strong>
              </div>

              {(entry.ticket_paths || []).length === 0 ? (
                <div className={entry.purchase_done ? "warning" : "softBox"}>
                  {entry.purchase_done ? "⚠️ Achat déclaré mais aucun ticket envoyé." : "Pas de ticket pour cette prestation."}
                </div>
              ) : (
                <div className="ticketsList">
                  {(entry.ticket_paths || []).map((path) => (
                    <TicketBlock
                      key={path}
                      path={path}
                      result={results[path]}
                      analyzing={analyzing}
                      onAnalyze={() => onAnalyze(path)}
                      getSignedUrl={getSignedUrl}
                      declaredAmount={Number(entry.purchase_amount || 0)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

function TicketBlock({ path, result, analyzing, onAnalyze, getSignedUrl, declaredAmount }) {
  const [url, setUrl] = useState("");

  async function openTicket() {
    if (url) {
      window.open(url, "_blank");
      return;
    }

    const signedUrl = await getSignedUrl(path);
    setUrl(signedUrl);
    window.open(signedUrl, "_blank");
  }

  return (
    <div className="ticketBlock">
      <div>
        <strong>{fileNameFromPath(path)}</strong>
        <span>{path}</span>
      </div>

      <div className="buttonRow">
        <button className="secondary" onClick={openTicket}>Voir ticket</button>
        <button className="primary" onClick={onAnalyze} disabled={analyzing}>
          {analyzing ? "Analyse..." : "Analyser OCR"}
        </button>
      </div>

      {result && (
        <div className={result.amountMismatch ? "analysisBox mismatch" : "analysisBox ok"}>
          <h3>{result.amountMismatch ? "⚠️ Montant à vérifier" : "✅ Analyse ticket"}</h3>

          <div className="detailGrid">
            <span>Montant déclaré</span>
            <strong>{formatCurrency(declaredAmount)}</strong>

            <span>Montant détecté</span>
            <strong>{result.detectedAmount ? formatCurrency(result.detectedAmount) : "Non détecté"}</strong>

            <span>Date détectée</span>
            <strong>{result.detectedDate || "Non détectée"}</strong>

            <span>Enseigne probable</span>
            <strong>{result.store || "Non détectée"}</strong>

            <span>Catégories</span>
            <strong>{result.productWords.join(", ") || "—"}</strong>
          </div>

          {result.productLines && result.productLines.length > 0 && (
            <div className="ocrProductReport">
              <h4>Produits détectés</h4>
              {result.productLines.map((line, index) => (
                <div className="ocrProductLine" key={index}>
                  <span>{line.label}</span>
                  <strong>{formatCurrency(line.amount)}</strong>
                  <em>{line.category}</em>
                </div>
              ))}
            </div>
          )}

          {result.categoryTotals && Object.keys(result.categoryTotals).length > 0 && (
            <div className="ocrCategoryReport">
              <h4>Résumé par catégorie</h4>
              {Object.entries(result.categoryTotals).map(([category, amount]) => (
                <div className="ocrCategoryLine" key={category}>
                  <span>{category}</span>
                  <strong>{formatCurrency(amount)}</strong>
                </div>
              ))}
            </div>
          )}

          <details>
            <summary>Texte OCR brut</summary>
            <pre>{result.rawText}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }) {
  return (
    <div className="kpi">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

async function extractPdfTextOrOcr(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let text = "";

  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 3); pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    text += "\n" + content.items.map((item) => item.str).join(" ");
  }

  if (text.trim().length > 30) return text;

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;

  return await ocrCanvas(canvas);
}

async function ocrBlob(blob) {
  const result = await Tesseract.recognize(blob, "fra+eng");
  return result.data.text || "";
}

async function ocrCanvas(canvas) {
  const result = await Tesseract.recognize(canvas, "fra+eng");
  return result.data.text || "";
}


function analyzeTicketText(text, declaredAmount) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  const amounts = extractAmounts(clean);
  const detectedAmount = detectTotalAmount(text, amounts);
  const detectedDate = extractDate(clean);
  const store = extractStore(clean);
  const productLines = extractTicketProductLines(text);
  const categoryTotals = productLines.reduce((acc, line) => {
    acc[line.category] = (acc[line.category] || 0) + line.amount;
    return acc;
  }, {});

  const productWords = [...new Set(productLines.map((line) => line.category).filter(Boolean))];

  if (productWords.length === 0) {
    productWords.push(...extractProductWords(clean));
  }

  const amountMismatch =
    declaredAmount > 0 &&
    detectedAmount > 0 &&
    Math.abs(declaredAmount - detectedAmount) > 0.25;

  return {
    rawText: text || "",
    amounts,
    detectedAmount,
    detectedDate,
    store,
    productWords,
    productLines,
    categoryTotals,
    amountMismatch,
    analyzedAt: new Date().toISOString(),
  };
}

function detectTotalAmount(text, amounts) {
  const raw = String(text || "");
  const lines = raw.split(/\n/).map((line) => line.trim()).filter(Boolean);

  const totalLine = lines.find((line) =>
    /total/i.test(line) && /\d+[,.]\d{2}/.test(line)
  );

  if (totalLine) {
    const lineAmounts = extractAmounts(totalLine);
    if (lineAmounts.length) return lineAmounts[lineAmounts.length - 1];
  }

  const cbLine = lines.find((line) =>
    /\b(cb|carte|visa|mastercard|especes|espèces)\b/i.test(line) && /\d+[,.]\d{2}/.test(line)
  );

  if (cbLine) {
    const lineAmounts = extractAmounts(cbLine);
    if (lineAmounts.length) return lineAmounts[lineAmounts.length - 1];
  }

  return amounts.length ? Math.max(...amounts) : 0;
}



function extractTicketProductLines(text) {
  const rawLines = String(text || "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const result = [];

  rawLines.forEach((line) => {
    const normalized = normalizeOcrLabel(line);

    if (isNonProductTicketLine(normalized)) return;

    const match = line.match(/(.+?)\s+(\d{1,4}[,.]\d{2})\s*$/);
    if (!match) return;

    const label = match[1].trim();
    const amount = Number(match[2].replace(",", "."));

    if (!label || !Number.isFinite(amount) || amount <= 0 || amount > 500) return;

    const cleanLabel = cleanTicketProductLabel(label);
    const cleanNormalized = normalizeOcrLabel(cleanLabel);

    if (!cleanLabel || isNonProductTicketLine(cleanNormalized)) return;

    result.push({
      label: cleanLabel,
      amount,
      category: classifyTicketProduct(cleanLabel),
    });
  });

  return result;
}

function normalizeOcrLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTicketProductLabel(label) {
  return String(label || "")
    .replace(/^\*+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}



function isNonProductTicketLine(normalized) {
  if (!normalized) return true;

  const hardExcludes = [
    "bon immediat",
    "bon immédiat",
    "bon d achat",
    "bon d'achat",
    "bon achat",
    "reste a payer",
    "reste à payer",
    "a payer",
    "à payer",
    "sous total",
    "sous-total",
    "total",
    "total articles",
    "cb",
    "carte",
    "visa",
    "mastercard",
    "especes",
    "espèces",
    "rendu",
    "remise",
    "ticket",
    "caisse",
    "tel",
    "telephone",
    "téléphone",
    "bienvenue",
    "catalogue",
    "retrouvez",
    "qr code",
    "grace a votre carte",
    "grâce à votre carte",
    "vous cumulez",
    "tva",
    "centre e leclerc",
    "centre e.leclerc",
    "leclerc",
    "lille fives",
    "rue de lannoy",
  ];

  if (hardExcludes.some((word) => normalized.includes(word))) return true;

  if (/^(cb|total|reste|bon|remise|rendu|carte|visa)\\b/.test(normalized)) return true;

  return false;
}


function classifyTicketProduct(label) {
  const n = normalizeOcrLabel(label);

  // Café / dosettes
  if (
    n.includes("senseo") ||
    n.includes("senso") ||
    n.includes("snco") ||
    n.includes("dos ") ||
    n.includes("dosette") ||
    n.includes("dosettes") ||
    n.includes("sple") ||
    n.includes("classiq") ||
    n.includes("classique") ||
    n.includes("cafe") ||
    n.includes("arabica")
  ) return "Café";

  // Sacs poubelle
  if (
    n.includes("sac poub") ||
    n.includes("sacs poub") ||
    n.includes("poubell") ||
    n.includes("poubelle") ||
    n.includes("100lx") ||
    n.includes("100l") ||
    n.includes("100l x") ||
    n.includes("sdb 10l") ||
    n.includes("sbd 10l")
  ) return "Sacs poubelle";

  // Nettoyants salle de bain / anti-calcaire
  if (
    n.includes("a/calcaire") ||
    n.includes("anti calcaire") ||
    n.includes("calcaire") ||
    n.includes("sdb") ||
    n.includes("sbd") ||
    n.includes("nettoy") ||
    n.includes("menage") ||
    n.includes("desinfect") ||
    n.includes("javel")
  ) return "Nettoyants";

  // Spray parfum / musc : on le garde en Autres pour l’instant
  if (
    n.includes("musc") ||
    n.includes("parfum") ||
    n.includes("cht usd spray")
  ) return "Autres";

  // Spray générique
  if (n.includes("spray")) return "Autres";

  // Papier toilette
  if (
    n.includes("toilet") ||
    n.includes("papier toilette") ||
    n.includes("ph blanc") ||
    n.includes("ph ") ||
    n.includes("mimosa")
  ) return "Papier toilette";

  // Cuisine / consommables
  if (
    n.includes("papier cuisson") ||
    n.includes("cuisson") ||
    n.includes("alu") ||
    n.includes("film")
  ) return "Cuisine / consommable";

  if (n.includes("vaisselle")) return "Liquide vaisselle";
  if (n.includes("eponge") || n.includes("lavette") || n.includes("gomme")) return "Éponge / lavette";
  if (n.includes("vinaigre")) return "Vinaigre";
  if (n.includes("savon") || n.includes("gel") || n.includes("mains")) return "Hygiène";
  if (n.includes("sucre") || n.includes("the") || n.includes("thé")) return "Accueil voyageurs";

  return "À classer";
}


function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value) {
  const number = Number(value) || 0;
  return number.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}

function fileNameFromPath(path) {
  return String(path || "").split("/").pop();
}

const ticketsStyles = `
* { box-sizing: border-box; }

body {
  margin: 0;
}

.ticketsApp {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(111,177,153,.28), transparent 35%),
    linear-gradient(135deg, #f7f4ef 0%, #efe7da 100%);
  color: #1f3f31;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 16px;
}

.loginCard,
.hero,
.entryCard,
.alertBox {
  width: min(980px, 100%);
  margin: 0 auto 14px;
  background: rgba(255,255,255,.86);
  border: 1px solid rgba(31,77,58,.09);
  border-radius: 26px;
  padding: 18px;
  box-shadow: 0 16px 40px rgba(31,77,58,.08);
}

.loginCard {
  max-width: 460px;
  margin-top: 8vh;
}

.logo {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: #1f4d3a;
  color: white;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 950;
  margin-bottom: 14px;
}

.eyebrow {
  margin: 0 0 8px;
  text-transform: uppercase;
  color: #8a6a4f;
  letter-spacing: .13em;
  font-size: 11px;
  font-weight: 950;
}

h1 {
  margin: 0 0 10px;
  font-size: clamp(32px, 7vw, 54px);
  line-height: .95;
  color: #1f4d3a;
}

h2 {
  margin: 0 0 8px;
  color: #1f4d3a;
}

p {
  color: #6d6257;
  line-height: 1.45;
}

label {
  display: grid;
  gap: 8px;
  margin: 14px 0;
  color: #1f4d3a;
  font-weight: 900;
}

input {
  width: 100%;
  border: 1px solid rgba(31,77,58,.16);
  border-radius: 16px;
  padding: 14px;
  font: inherit;
}

button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.primary,
.secondary {
  border-radius: 16px;
  padding: 12px 14px;
  font-weight: 950;
}

.primary {
  background: #1f4d3a;
  color: white;
}

.secondary {
  background: #f7f4ef;
  color: #1f4d3a;
}

.primary:disabled {
  opacity: .6;
}

.message {
  width: min(980px, 100%);
  margin: 0 auto 14px;
  background: white;
  border-radius: 18px;
  padding: 12px 14px;
  color: #1f4d3a;
  font-weight: 850;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.kpiGrid {
  width: min(980px, 100%);
  margin: 0 auto 14px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.kpi {
  background: rgba(255,255,255,.86);
  border-radius: 22px;
  padding: 14px;
  box-shadow: 0 12px 30px rgba(31,77,58,.06);
}

.kpi span {
  font-size: 25px;
}

.kpi p {
  margin: 8px 0 4px;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: #8a6a4f;
  font-size: 11px;
  font-weight: 950;
}

.kpi strong {
  color: #1f4d3a;
  font-size: 24px;
}

.list {
  width: min(980px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 12px;
}

.entryTop {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  cursor: pointer;
}

.roundButton {
  width: 42px;
  height: 42px;
  border-radius: 16px;
  background: #f7f4ef;
  color: #1f4d3a;
  font-size: 24px;
  font-weight: 950;
}

.entryDetails {
  margin-top: 14px;
  display: grid;
  gap: 12px;
}

.detailGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  background: #f7f4ef;
  border-radius: 18px;
  padding: 14px;
}

.detailGrid span {
  color: #8a6a4f;
  font-size: 13px;
}

.detailGrid strong {
  text-align: right;
  color: #1f4d3a;
  overflow-wrap: anywhere;
}

.warning,
.softBox,
.alertItem {
  border-radius: 18px;
  padding: 14px;
  font-weight: 850;
}

.warning,
.alertBox {
  background: #fff4e6;
  color: #8a4b00;
}

.softBox {
  background: #f7f4ef;
  color: #6d6257;
}

.alertItem {
  background: rgba(255,255,255,.65);
  margin-top: 8px;
}

.alertItem strong,
.alertItem span {
  display: block;
}

.ticketsList {
  display: grid;
  gap: 12px;
}

.ticketBlock {
  background: #f7f4ef;
  border-radius: 20px;
  padding: 14px;
  display: grid;
  gap: 12px;
}

.ticketBlock strong,
.ticketBlock span {
  display: block;
  overflow-wrap: anywhere;
}

.ticketBlock span {
  color: #6d6257;
  font-size: 13px;
  margin-top: 4px;
}

.buttonRow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.analysisBox {
  border-radius: 20px;
  padding: 14px;
}

.analysisBox.ok {
  background: #def7e8;
}

.analysisBox.mismatch {
  background: #ffe0df;
}

.analysisBox h3 {
  margin-top: 0;
}

details {
  margin-top: 12px;
}

pre {
  white-space: pre-wrap;
  background: rgba(255,255,255,.72);
  border-radius: 14px;
  padding: 12px;
  max-height: 260px;
  overflow: auto;
}


.ocrProductReport,
.ocrCategoryReport {
  margin-top: 14px;
  background: rgba(255,255,255,.74);
  border-radius: 18px;
  padding: 14px;
}

.ocrProductReport h4,
.ocrCategoryReport h4 {
  margin: 0 0 10px;
  color: #1f4d3a;
  font-size: 18px;
}

.ocrProductLine,
.ocrCategoryLine {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(31,77,58,.10);
}

.ocrProductLine:last-child,
.ocrCategoryLine:last-child {
  border-bottom: 0;
}

.ocrProductLine span,
.ocrCategoryLine span {
  color: #1f4d3a;
  font-weight: 850;
}

.ocrProductLine strong,
.ocrCategoryLine strong {
  color: #1f4d3a;
  font-weight: 950;
}

.ocrProductLine em {
  grid-column: 1 / -1;
  color: #8a6a4f;
  font-style: normal;
  font-weight: 850;
  font-size: 13px;
}



.purchaseReport {
  width: min(980px, 100%);
  margin: 0 auto 14px;
  background:
    radial-gradient(circle at top left, rgba(126,226,168,.25), transparent 30%),
    linear-gradient(135deg, rgba(255,255,255,.92), rgba(239,255,247,.90));
  border: 1px solid rgba(31,77,58,.10);
  border-radius: 28px;
  padding: 20px;
  box-shadow: 0 18px 44px rgba(31,77,58,.10);
}

.purchaseReport h2 {
  margin-bottom: 14px;
}

.purchaseReportKpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.purchaseReportKpis div,
.categoryChip {
  background: rgba(255,255,255,.82);
  border-radius: 18px;
  padding: 12px;
  box-shadow: 0 8px 18px rgba(31,77,58,.06);
}

.purchaseReportKpis span,
.categoryChip span {
  display: block;
  color: #8a6a4f;
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.purchaseReportKpis strong,
.categoryChip strong {
  display: block;
  color: #1f4d3a;
  font-size: 22px;
  margin-top: 4px;
}

.categoryChips {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.categoryChip {
  min-width: 150px;
}

.purchaseTableWrap {
  overflow-x: auto;
  border-radius: 18px;
  background: white;
}

.purchaseTable {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

.purchaseTable th,
.purchaseTable td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid rgba(31,77,58,.10);
  color: #1f4d3a;
}

.purchaseTable th {
  background: #eff8f2;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.purchaseTable td {
  font-weight: 750;
}

.purchaseTable td:last-child {
  font-weight: 950;
}



.purchaseFilters {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-bottom: 14px;
  background: rgba(255,255,255,.72);
  padding: 14px;
  border-radius: 22px;
}

.purchaseFilters label {
  display: grid;
  gap: 6px;
  color: #1f4d3a;
  font-weight: 950;
}

.purchaseFilters input,
.purchaseFilters select {
  border: 1px solid rgba(31,77,58,.16);
  border-radius: 16px;
  padding: 12px;
  font: inherit;
  background: white;
  color: #1f4d3a;
}

.familyReport {
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
}

.familyCard {
  background: rgba(255,255,255,.82);
  border-radius: 20px;
  padding: 12px 14px;
  box-shadow: 0 10px 22px rgba(31,77,58,.06);
}

.familyCard summary {
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  color: #1f4d3a;
  font-weight: 950;
}

.familyCard summary span {
  font-size: 18px;
}

.familyCard summary strong {
  font-size: 15px;
}

.familyArticles {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}

.familyArticle {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  background: #eff8f2;
  border-radius: 14px;
  padding: 10px 12px;
  color: #1f4d3a;
}

.familyArticle span {
  font-weight: 850;
}

.familyArticle strong {
  font-weight: 950;
}

@media (min-width: 760px) {
  .purchaseFilters {
    grid-template-columns: repeat(3, 1fr);
  }
}


@media (min-width: 760px) {
  .kpiGrid {
    grid-template-columns: repeat(4, 1fr);
  }

  .loginCard,
  .hero,
  .entryCard,
  .alertBox {
    padding: 24px;
  }
}
`;
