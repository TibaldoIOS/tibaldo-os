import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function TibaldoSmartUploadWidget() {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const isHome = typeof window !== "undefined" && window.location.pathname === "/";

  useEffect(() => {
    function handleOpenUpload() {
      setOpen(true);
    }

    window.addEventListener("openTibaldoUpload", handleOpenUpload);
    return () => window.removeEventListener("openTibaldoUpload", handleOpenUpload);
  }, []);

  if (!isHome) return null;

  async function uploadFiles(event) {
    event.preventDefault();

    if (!files.length) {
      setMessage("Choisis au moins un document.");
      return;
    }

    setUploading(true);
    setMessage(`Préparation de ${files.length} document(s)...`);

    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    let airbnbLines = 0;
    let bankLines = 0;
    const errorDetails = [];

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user?.id) {
        throw new Error("Utilisateur non connecté.");
      }

      const { data: existingDocs } = await supabase
        .from("documents")
        .select("id,unique_key,file_name")
        .limit(1000);

      for (const file of files) {
        try {
          setMessage(`Analyse : ${file.name}`);

          const hash = await fileHash(file);
          const duplicate = (existingDocs || []).find((doc) => doc.unique_key === hash);

          const analysis = await analyzeFile(file);

          if (duplicate) {
            duplicates += 1;

            if (analysis.category === "Airbnb" && duplicate.id) {
              await supabase
                .from("airbnb_report_lines")
                .delete()
                .eq("document_id", duplicate.id);

              const insertedLines = await saveAirbnbReportLines(duplicate.id, analysis);
              airbnbLines += insertedLines;
            }

            if (analysis.category === "Banque" && duplicate.id) {
              await supabase
                .from("bank_statement_lines")
                .delete()
                .eq("document_id", duplicate.id);

              const insertedBankLines = await saveBankStatementLines(duplicate.id, analysis);
              bankLines += insertedBankLines;
            }

            continue;
          }
          const today = new Date().toISOString().slice(0, 10);
          const cleanName = sanitizeFileName(file.name);
          const userId = userData.user.id;
          const category = analysis.category || "Autre";
          const storagePath = `${userId}/documents/${category.toLowerCase()}/${today}/${Date.now()}-${hash.slice(0, 14)}-${cleanName}`;

          setMessage(`Upload : ${file.name}`);

          const { error: uploadError } = await supabase.storage
            .from("tibaldo-documents")
            .upload(storagePath, file, {
              cacheControl: "3600",
              upsert: true,
            });

          if (uploadError) throw uploadError;

          const { data: insertedDoc, error: insertError } = await supabase
            .from("documents")
            .insert({
              title: file.name,
              file_name: file.name,
              file_path: storagePath,
              file_size: file.size,
              file_type: file.type || null,

              document_category: category,
              document_source: analysis.source || null,
              document_period_start: analysis.periodStart || null,
              document_period_end: analysis.periodEnd || null,
              document_year: analysis.periodStart ? Number(analysis.periodStart.slice(0, 4)) : null,
              document_month: analysis.periodStart ? Number(analysis.periodStart.slice(5, 7)) : null,

              property: analysis.property || null,
              amount_income: analysis.amountIncome || 0,
              amount_expense: analysis.amountExpense || 0,
              amount_total: analysis.amountTotal || 0,

              notes: analysis.summary || null,
              unique_key: hash,
              status: analysis.category ? "analyse_auto" : "importe",
            })
            .select("id")
            .single();

          if (insertError) throw insertError;

          if (analysis.category === "Airbnb" && insertedDoc?.id) {
            const insertedLines = await saveAirbnbReportLines(insertedDoc.id, analysis);
            airbnbLines += insertedLines;
          }

          if (analysis.category === "Banque" && insertedDoc?.id) {
            const insertedBankLines = await saveBankStatementLines(insertedDoc.id, analysis);
            bankLines += insertedBankLines;
          }

          imported += 1;
        } catch (error) {
          console.error(error);
          errors += 1;
          errorDetails.push(`${file.name} : ${error.message || JSON.stringify(error)}`);
        }
      }

      setFiles([]);
      setMessage(
        `Import terminé ✅ ${imported} ajouté(s), ${duplicates} doublon(s), ${errors} erreur(s), ${airbnbLines} ligne(s) Airbnb, ${bankLines} ligne(s) Banque.` +
        (errorDetails.length ? ` Erreur : ${errorDetails[0]}` : "")
      );
    } catch (error) {
      setMessage("Erreur : " + error.message);
    }

    setUploading(false);
  }

  return (
    <>
      <button className="smartUploadBubble hiddenLegacyBubble" onClick={() => setOpen(true)}>
        <span>📥</span>
        <strong>Déposer</strong>
      </button>

      {open && (
        <div className="smartUploadPanel">
          <div className="smartUploadHeader">
            <div>
              <p>Tibaldo OS</p>
              <h2>📥 Dépôt intelligent</h2>
            </div>
            <button onClick={() => setOpen(false)}>×</button>
          </div>

          <form onSubmit={uploadFiles} className="smartUploadBody">
            <p className="smartUploadIntro">
              Dépose ici tes documents. Les rapports Airbnb sont maintenant enregistrés dans le reporting par logement.
            </p>

            <label className="smartUploadDrop">
              Choisir PDF / documents
              <input
                type="file"
                multiple
                accept="image/*,application/pdf,.csv,.xlsx,.xls,.ofx,.qif,.txt"
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
            </label>

            {files.length > 0 && (
              <div className="smartUploadFiles">
                <strong>{files.length} document(s) sélectionné(s)</strong>
                {files.slice(0, 6).map((file) => (
                  <span key={file.name}>{file.name}</span>
                ))}
                {files.length > 6 && <span>+ {files.length - 6} autre(s)</span>}
              </div>
            )}

            <button className="smartUploadSubmit" disabled={uploading}>
              {uploading ? "Traitement..." : "Analyser et enregistrer"}
            </button>

            {message && <p className="smartUploadMessage">{message}</p>}

            <p className="smartUploadMini">
              Airbnb global : Fives = chambres 1/2/3/4 · Melezio = logement entier + chambres côté rue/jardin · Wattignies = Wattignies.
            </p>
          </form>
        </div>
      )}

      <style>{styles}</style>
    </>
  );
}


async function saveBankStatementLines(documentId, analysis) {
  const lines = analysis.bankLines || [];

  if (!lines.length) return 0;

  const { error: deleteError } = await supabase
    .from("bank_statement_lines")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    console.warn("Anciennes lignes bancaires non supprimées", deleteError);
    throw deleteError;
  }

  const rows = lines.map((line) => ({
    document_id: documentId,
    bank_name: analysis.bankName || "Crédit Agricole",
    account_label: analysis.accountLabel || null,
    statement_period_start: analysis.periodStart || null,
    statement_period_end: analysis.periodEnd || null,
    operation_date: line.operation_date || null,
    value_date: line.value_date || null,
    raw_label: line.raw_label || "Opération bancaire",
    clean_label: line.clean_label || line.raw_label || "Opération bancaire",
    detected_category: line.detected_category || "Non classé",
    detected_subcategory: line.detected_subcategory || null,
    amount: line.amount || 0,
    amount_in: line.amount_in || 0,
    amount_out: line.amount_out || 0,
    is_income: !!line.is_income,
    is_expense: !!line.is_expense,
    is_transfer: !!line.is_transfer,
    is_professional: line.is_professional ?? null,
    confidence: line.confidence || 0.6,
    notes: line.notes || null,
  }));

  const { error } = await supabase.from("bank_statement_lines").insert(rows);

  if (error) {
    console.warn("Insertion bank_statement_lines impossible", error);
    throw error;
  }

  return rows.length;
}


async function loadBankCategoryRules() {
  const { data, error } = await supabase
    .from("bank_category_rules")
    .select("*")
    .order("priority", { ascending: true });

  if (error) {
    console.warn("Règles bancaires non chargées", error);
    return [];
  }

  return data || [];
}

function applyBankCategoryRules(label, rules = []) {
  const normalizedLabel = normalizeRuleText(label);

  for (const rule of rules) {
    const keyword = normalizeRuleText(rule.keyword);

    if (!keyword) continue;

    if (normalizedLabel.includes(keyword)) {
      return {
        category: rule.category || "Non classé",
        subcategory: rule.subcategory || null,
        isTransfer: !!rule.is_transfer,
        isProfessional: rule.is_professional ?? null,
        confidence: 0.97,
        notes: rule.notes || "Catégorie appliquée depuis bank_category_rules.",
      };
    }
  }

  return null;
}

function normalizeRuleText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}


function parseCreditAgricoleStatement(text, categoryRules = []) {
  const clean = String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ");

  const isCreditAgricole =
    /credit agricole/i.test(clean) &&
    /releve de comptes/i.test(clean);

  if (!isCreditAgricole) return null;

  const yearMatch = clean.match(/Date d'arrêté\s*:\s*(\d{2})\s+([A-Za-zéûîôà]+)\s+(20\d{2})/i);
  const statementYear = yearMatch ? Number(yearMatch[3]) : new Date().getFullYear();

  const endDate = yearMatch
    ? frenchDateToIso(`${yearMatch[1]} ${yearMatch[2]} ${yearMatch[3]}`)
    : null;

  const oldBalanceMatch = clean.match(/Ancien solde créditeur au\s+(\d{2})\.(\d{2})\.(20\d{2})/i);
  const periodStart = oldBalanceMatch
    ? `${oldBalanceMatch[3]}-${oldBalanceMatch[2]}-${oldBalanceMatch[1]}`
    : null;

  const accountMatch = clean.match(/Compte Chèque n[°º]\s*([0-9]+)/i);

  const operationRegex =
    /(\d{2})\.(\d{2})\s+(\d{2})\.(\d{2})\s+([\s\S]*?)(\d{1,3}(?: \d{3})*,\d{2})\s*¨/g;

  const bankLines = [];
  let match;

  while ((match = operationRegex.exec(clean)) !== null) {
    const opDay = match[1];
    const opMonth = match[2];
    const valDay = match[3];
    const valMonth = match[4];
    const labelRaw = normalizeBankLabel(match[5]);
    let amountValue = parseFrenchMoney(match[6]);

    // Correction Crédit Agricole :
    // certains PDF sortent 658,19 sous forme 658195 / 26463 / 42000.
    // On ramène ces valeurs à des montants réalistes.
    if (amountValue >= 10000) {
      amountValue = amountValue / 1000;
    }

    if (!labelRaw) continue;
    if (/ancien solde|nouveau solde|total des opérations/i.test(labelRaw)) continue;

    const isCredit = isCreditOperation(labelRaw);
    const category = applyBankCategoryRules(labelRaw, categoryRules) || categorizeBankLine(labelRaw, isCredit);

    bankLines.push({
      operation_date: `${statementYear}-${opMonth}-${opDay}`,
      value_date: `${statementYear}-${valMonth}-${valDay}`,
      raw_label: labelRaw,
      clean_label: cleanBankLabel(labelRaw),
      detected_category: category.category,
      detected_subcategory: category.subcategory,
      amount: isCredit ? amountValue : -amountValue,
      amount_in: isCredit ? amountValue : 0,
      amount_out: isCredit ? 0 : amountValue,
      is_income: isCredit,
      is_expense: !isCredit,
      is_transfer: category.isTransfer,
      is_professional: category.isProfessional,
      confidence: category.confidence,
      notes: category.notes,
    });
  }

  return {
    category: "Banque",
    source: "Crédit Agricole",
    bankName: "Crédit Agricole Nord de France",
    accountLabel: accountMatch ? `Compte Chèque n° ${accountMatch[1]}` : "Compte Chèque",
    periodStart,
    periodEnd: endDate,
    amountIncome: bankLines.reduce((sum, line) => sum + (Number(line.amount_in) || 0), 0),
    amountExpense: bankLines.reduce((sum, line) => sum + (Number(line.amount_out) || 0), 0),
    amountTotal: bankLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    summary: `Relevé Crédit Agricole détecté : ${bankLines.length} opération(s) extraite(s).`,
    bankLines,
  };
}





function parseAmericanExpressStatement(text, categoryRules = []) {
  const raw = String(text || "").replace(/\u00a0/g, " ");
  const fullClean = raw.replace(/\s+/g, " ").trim();

  if (!/american express/i.test(fullClean) || !/relevé de compte|releve de compte/i.test(fullClean)) {
    return null;
  }

  const headerDate = fullClean.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2})\/(\d{2})\/(\d{2})/);
  const statementYear = headerDate ? Number(`20${headerDate[3]}`) : new Date().getFullYear();
  const periodStart = headerDate ? `20${headerDate[3]}-${headerDate[2]}-${headerDate[1]}` : null;
  const periodEnd = headerDate ? `20${headerDate[6]}-${headerDate[5]}-${headerDate[4]}` : null;
  const accountMatch = fullClean.match(/xxxx-xxxxxx-\d+/i);

  const monthMap = {
    jan: "01", fev: "02", fév: "02", mar: "03", mars: "03",
    avr: "04", mai: "05", juin: "06", juil: "07",
    aout: "08", août: "08", sept: "09", oct: "10",
    nov: "11", dec: "12", déc: "12"
  };

  function toIso(day, monthText) {
    const month = monthMap[String(monthText || "").toLowerCase()];
    if (!month) return null;
    return `${statementYear}-${month}-${String(day).padStart(2, "0")}`;
  }

  const merchantSplit = /(?=\b(?:UBER|UBER EATS|SNCF|AMA EU|OPUS|SUMUP|AMAZON|LE PALAIS|TIBALDO|AUCHAN|APPLE|TEMU|AUXINE|PAYPAL|PICNIC|3 BRASSEURS|GENERAL|SP |ZOOPLUS|VTC|CHEZ|RELAY|LE NAPOLEON|DAEHAN|IT TRATTORIA|BARBER|LM |LEROY|WATTIGNIES|NEXTORY|BABYLON|Q8 |AIRBNB|DISTRITEP|HARIBO|SUPERDRY|SASU|EXOTIC|KONU|ROCKETME|JACQUET|LILLE LILLE|BABYLON|NEXTORY)\b)/g;

  const bankLines = [];
  const pages = raw.split(/\n+/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);

  for (const page of pages) {
    if (!/Page\s+\d+\s*\/\s*\d+/i.test(page)) continue;
    if (/Votre Relevé de Miles|Récapitulatif des frais|Décompte des frais/i.test(page)) continue;

    const beforePage = page.split(/Page\s+\d+\s*\/\s*\d+/i)[0] || "";
    let pageDates = [...beforePage.matchAll(/(\d{1,2})\s+(jan|fév|fev|mar|mars|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec)\s+(\d{1,2})\s+(jan|fév|fev|mar|mars|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec)/gi)];

    let labelBlock = page.split(/Page\s+\d+\s*\/\s*\d+/i)[1] || "";
    labelBlock = labelBlock
      .replace(/American Express Carte[\s\S]*$/i, "")
      .replace(/Le solde de votre relevé[\s\S]*$/i, "")
      .replace(/Nom Numéro de Compte[\s\S]*$/i, "")
      .replace(/Facturation-paiement[\s\S]*$/i, "")
      .replace(/Total des dépenses[\s\S]*$/i, "")
      .replace(/EN SUSPENS[\s\S]*$/i, "")
      .replace(/PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI/gi, "")
      .trim();

    let labels = labelBlock
      .split(merchantSplit)
      .map((x) => normalizeBankLabel(x))
      .filter((x) => x.length > 3)
      .filter((x) => !/MILES|FLYING BLUE|INFORMATIONS IMPORTANTES|SERVICE CLIENT|NUMÉRO DE COMPTE|AMERICAN EXPRESS/i.test(x))
      .filter((x) => !/SUSPENSION DE DEPENSE|ANNULATION SUSPENSION|CREDIT\/DEPENSE/i.test(x));

    let amountBlock = page;
    if (/Opérations pour ROMAIN PRUVOST/i.test(amountBlock)) {
      amountBlock = amountBlock.replace(/[\s\S]*?Opérations pour ROMAIN PRUVOST/i, "");
    } else if (/Montant en\s*EUR/i.test(amountBlock)) {
      amountBlock = amountBlock.replace(/[\s\S]*?Montant en\s*EUR/i, "");
    }

    amountBlock = amountBlock
      .replace(/Facturation-paiement[\s\S]*$/i, "")
      .replace(/Carte Air France[\s\S]*$/i, "")
      .replace(/Total des dépenses[\s\S]*$/i, "")
      .replace(/EN SUSPENS[\s\S]*$/i, "");

    let amounts = [...amountBlock.matchAll(/(?:^|\s)(\d{1,3}(?:\s\d{3})*,\d{2})(?:\s|$)/g)]
      .map((m) => parseFrenchMoney(m[1]))
      .filter((n) => n > 0)
      .filter((n) => n < 2200);

    // Si la page contient le prélèvement automatique en haut, on enlève sa date.
    if (/PRELEVEMENT AUTOMATIQUE ENREGISTRE-MERCI/i.test(page) && pageDates.length > labels.length) {
      pageDates = pageDates.slice(1);
    }

    const count = Math.min(pageDates.length, labels.length, amounts.length);

    for (let i = 0; i < count; i++) {
      const dm = pageDates[i];
      const opDate = toIso(dm[1], dm[2]);
      const valueDate = toIso(dm[3], dm[4]);
      const labelRaw = labels[i];
      const amountValue = amounts[i];

      if (!opDate || !labelRaw || !amountValue) continue;

      const isCredit = /ANNULATION|CREDIT|REMBOURS/i.test(labelRaw);
      const category = applyBankCategoryRules(labelRaw, categoryRules) || categorizeBankLine(labelRaw, isCredit);

      bankLines.push({
        operation_date: opDate,
        value_date: valueDate,
        raw_label: labelRaw,
        clean_label: cleanBankLabel(labelRaw),
        detected_category: category.category,
        detected_subcategory: category.subcategory,
        amount: isCredit ? amountValue : -amountValue,
        amount_in: isCredit ? amountValue : 0,
        amount_out: isCredit ? 0 : amountValue,
        is_income: isCredit,
        is_expense: !isCredit,
        is_transfer: category.isTransfer,
        is_professional: category.isProfessional,
        confidence: category.confidence,
        notes: "Import American Express PDF page par page",
      });
    }
  }

  console.log("AMEX PAGE PARSER", {
    bankLines: bankLines.length,
    totalOut: bankLines.reduce((s, l) => s + (Number(l.amount_out) || 0), 0)
  });

  return {
    category: "Banque",
    source: "American Express",
    bankName: "American Express",
    accountLabel: accountMatch ? `Carte ${accountMatch[0]}` : "Carte American Express",
    periodStart,
    periodEnd,
    amountIncome: bankLines.reduce((sum, line) => sum + (Number(line.amount_in) || 0), 0),
    amountExpense: bankLines.reduce((sum, line) => sum + (Number(line.amount_out) || 0), 0),
    amountTotal: bankLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    summary: `Relevé American Express détecté : ${bankLines.length} opération(s) extraite(s).`,
    bankLines,
  };
}



function parseSocieteGeneraleCreditDuNordStatement(text, categoryRules = []) {
  const clean = String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isSgCdn =
    /cr[eé]dit du nord/i.test(clean) ||
    /soci[eé]t[eé] g[eé]n[eé]rale/i.test(clean) ||
    /particuliers\.sg\.fr/i.test(clean);

  if (!isSgCdn || !/relev[eé] de compte/i.test(clean)) return null;

  const headerDate = clean.match(/du\s+(\d{2})\/(\d{2})\/(20\d{2})\s+au\s+(\d{2})\/(\d{2})\/(20\d{2})/i);
  const statementYear = headerDate ? Number(headerDate[6]) : new Date().getFullYear();
  const periodStart = headerDate ? `${headerDate[3]}-${headerDate[2]}-${headerDate[1]}` : null;
  const periodEnd = headerDate ? `${headerDate[6]}-${headerDate[5]}-${headerDate[4]}` : null;

  const accountMatch = clean.match(/n[°º]\s*([0-9 ]{8,})/i);

  const sectionMatch = clean.match(/RELEV[ÉE] DES OP[ÉE]RATIONS[\s\S]*?(?=TOTAUX DES MOUVEMENTS|NOUVEAU SOLDE|Les écritures|$)/i);
  const section = sectionMatch ? sectionMatch[0] : clean;

  const opRegex = /(\d{2})\/(\d{2})\/(20\d{2})\s+(\d{2})\/(\d{2})\/(20\d{2})\s+([\s\S]*?)\s+((?:\d{1,3}(?:\s\d{3})*,\d{2})?)\s*((?:\d{1,3}(?:\s\d{3})*,\d{2})?)\s*(?=\d{2}\/\d{2}\/20\d{2}|TOTAUX DES MOUVEMENTS|NOUVEAU SOLDE|$)/g;

  const bankLines = [];
  let match;

  while ((match = opRegex.exec(section)) !== null) {
    const opDate = `${match[3]}-${match[2]}-${match[1]}`;
    const valueDate = `${match[6]}-${match[5]}-${match[4]}`;
    const labelRaw = normalizeBankLabel(match[7]);
    const debitRaw = String(match[8] || "").trim();
    const creditRaw = String(match[9] || "").trim();

    if (!labelRaw) continue;
    if (/solde précédent|solde precedent|totaux des mouvements|nouveau solde/i.test(labelRaw)) continue;

    const debit = debitRaw ? parseFrenchMoney(debitRaw) : 0;
    const credit = creditRaw ? parseFrenchMoney(creditRaw) : 0;

    if (!debit && !credit) continue;

    const isCredit = credit > 0;
    const amountValue = isCredit ? credit : debit;
    const category = applyBankCategoryRules(labelRaw, categoryRules) || categorizeBankLine(labelRaw, isCredit);

    bankLines.push({
      operation_date: opDate,
      value_date: valueDate,
      raw_label: labelRaw,
      clean_label: cleanBankLabel(labelRaw),
      detected_category: category.category,
      detected_subcategory: category.subcategory,
      amount: isCredit ? amountValue : -amountValue,
      amount_in: isCredit ? amountValue : 0,
      amount_out: isCredit ? 0 : amountValue,
      is_income: isCredit,
      is_expense: !isCredit,
      is_transfer: category.isTransfer,
      is_professional: category.isProfessional,
      confidence: category.confidence,
      notes: "Import SG Crédit du Nord PDF",
    });
  }

  return {
    category: "Banque",
    source: "SG Crédit du Nord",
    bankName: "SG Crédit du Nord",
    accountLabel: accountMatch ? `Compte n° ${accountMatch[1].replace(/\s/g, "")}` : "Compte SG Crédit du Nord",
    periodStart,
    periodEnd,
    amountIncome: bankLines.reduce((sum, line) => sum + (Number(line.amount_in) || 0), 0),
    amountExpense: bankLines.reduce((sum, line) => sum + (Number(line.amount_out) || 0), 0),
    amountTotal: bankLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    summary: `Relevé SG Crédit du Nord détecté : ${bankLines.length} opération(s) extraite(s).`,
    bankLines,
  };
}






function parseBforBankStatement(text, categoryRules = []) {
  const clean = String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !/bforbank/i.test(clean) &&
    !/relevé mensuel de compte bancaire/i.test(clean)
  ) {
    return null;
  }

  const bankLines = [];

  const operationRegex =
    /(\d{2})\/(\d{2})\/(20\d{2})\s+(\d{2})\/(\d{2})\/(20\d{2})\s+([\s\S]*?)\s+(-?\d[\d\s]*,\d{2})\s*€/g;

  let match;

  while ((match = operationRegex.exec(clean)) !== null) {
    const labelRaw = normalizeBankLabel(match[7]);
    const amountValue = parseFrenchMoney(match[8]);

    if (!labelRaw || !amountValue) continue;

    const isIncome =
      !labelRaw.toLowerCase().includes("reglement cartes debit differe") &&
      !match[8].trim().startsWith("-");

    const category =
      applyBankCategoryRules(labelRaw, categoryRules) ||
      categorizeBankLine(labelRaw, isIncome);

    bankLines.push({
      operation_date: `${match[3]}-${match[2]}-${match[1]}`,
      value_date: `${match[6]}-${match[5]}-${match[4]}`,
      raw_label: labelRaw,
      clean_label: cleanBankLabel(labelRaw),
      detected_category: category.category,
      detected_subcategory: category.subcategory,
      amount: isIncome ? amountValue : -amountValue,
      amount_in: isIncome ? amountValue : 0,
      amount_out: isIncome ? 0 : amountValue,
      is_income: isIncome,
      is_expense: !isIncome,
      is_transfer: category.isTransfer,
      is_professional: category.isProfessional,
      confidence: category.confidence,
      notes: "Import BforBank PDF",
    });
  }

  return {
    category: "Banque",
    source: "BforBank",
    bankName: "BforBank",
    accountLabel: "Compte BforBank",
    amountIncome: bankLines.reduce((s,l)=>s+(l.amount_in||0),0),
    amountExpense: bankLines.reduce((s,l)=>s+(l.amount_out||0),0),
    amountTotal: bankLines.reduce((s,l)=>s+(l.amount||0),0),
    summary: `Relevé BforBank détecté : ${bankLines.length} opération(s)`,
    bankLines,
  };
}


function normalizeBankLabel(label) {
  return String(label || "")
    .replace(/\s+/g, " ")
    .replace(/\bPage\s+\d+\s*\/\s*\d+\b/gi, "")
    .replace(/\bDate opé\.?\b/gi, "")
    .replace(/\bDate valeur\b/gi, "")
    .replace(/\bLibellé des opérations\b/gi, "")
    .replace(/\bDébit\b/gi, "")
    .replace(/\bCrédit\b/gi, "")
    .trim();
}

function cleanBankLabel(label) {
  return String(label || "")
    .replace(/G-[A-Z0-9]+Airbnb/gi, "Airbnb")
    .replace(/FR[0-9A-Z]+/g, "")
    .replace(/\bCore\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFrenchMoney(value) {
  const raw = String(value || "0").trim();

  if (raw.includes(",")) {
    return Number(raw.replace(/\s/g, "").replace(",", ".")) || 0;
  }

  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return 0;

  // Certains PDF Crédit Agricole extraient 658,19 en 658195.
  // On corrige ces montants aberrants en replaçant la décimale.
  if (digitsOnly.length >= 4) {
    return (Number(digitsOnly) || 0) / 1000;
  }

  return Number(digitsOnly) || 0;
}

function frenchDateToIso(value) {
  const months = {
    janvier: "01",
    fevrier: "02",
    février: "02",
    mars: "03",
    avril: "04",
    mai: "05",
    juin: "06",
    juillet: "07",
    aout: "08",
    août: "08",
    septembre: "09",
    octobre: "10",
    novembre: "11",
    decembre: "12",
    décembre: "12",
  };

  const match = String(value || "").toLowerCase().match(/(\d{2})\s+([a-zéûîôà]+)\s+(20\d{2})/i);
  if (!match) return null;

  const month = months[match[2]];
  if (!month) return null;

  return `${match[3]}-${month}-${match[1]}`;
}

function isCreditOperation(label) {
  const l = String(label || "").toLowerCase();

  if (l.includes("virement airbnb payments")) return true;
  if (l.includes("rembours")) return true;
  if (l.includes("intérêts") || l.includes("interets")) return true;
  if (l.includes("wero de")) return true;

  return false;
}

function categorizeBankLine(label, isCredit) {
  const l = String(label || "").toLowerCase();

  if (l.includes("airbnb payments")) {
    return {
      category: "Revenus Airbnb",
      subcategory: "Airbnb",
      isTransfer: false,
      isProfessional: true,
      confidence: 0.98,
      notes: null,
    };
  }

  if (l.includes("electricité de france") || l.includes("edf") || l.includes("octopus")) {
    return {
      category: "Énergie",
      subcategory: "Électricité / gaz",
      isTransfer: false,
      isProfessional: true,
      confidence: 0.9,
      notes: null,
    };
  }

  if (l.includes("free telecom") || l.includes("free mobile") || l.includes("sfr")) {
    return {
      category: "Télécom",
      subcategory: "Internet / mobile",
      isTransfer: false,
      isProfessional: true,
      confidence: 0.9,
      notes: null,
    };
  }

  if (l.includes("assurance") || l.includes("allianz") || l.includes("predica") || l.includes("pacifica")) {
    return {
      category: "Assurances",
      subcategory: "Assurance",
      isTransfer: false,
      isProfessional: true,
      confidence: 0.86,
      notes: null,
    };
  }

  if (l.includes("prêt") || l.includes("pret") || l.includes("crcam du nord") || l.includes("ech prêt")) {
    return {
      category: "Crédits",
      subcategory: "Prêt / crédit",
      isTransfer: false,
      isProfessional: null,
      confidence: 0.88,
      notes: null,
    };
  }

  if (l.includes("direction générale des finances") || l.includes("impôt") || l.includes("impot")) {
    return {
      category: "Impôts",
      subcategory: "Fiscalité",
      isTransfer: false,
      isProfessional: true,
      confidence: 0.92,
      notes: null,
    };
  }

  if (l.includes("syndicat") || l.includes("sergic")) {
    return {
      category: "Immobilier",
      subcategory: "Charges / syndic",
      isTransfer: false,
      isProfessional: true,
      confidence: 0.85,
      notes: null,
    };
  }

  if (l.includes("banque populaire") || l.includes("romain pruvost") || l.includes("virement vir inst")) {
    return {
      category: "Virements internes",
      subcategory: isCredit ? "Entrée interne" : "Sortie interne",
      isTransfer: true,
      isProfessional: null,
      confidence: 0.78,
      notes: "À vérifier : virement interne ou charge réelle.",
    };
  }

  if (l.includes("offre compte")) {
    return {
      category: "Frais bancaires",
      subcategory: "Compte bancaire",
      isTransfer: false,
      isProfessional: null,
      confidence: 0.9,
      notes: null,
    };
  }

  return {
    category: isCredit ? "Entrées à classer" : "Dépenses à classer",
    subcategory: null,
    isTransfer: false,
    isProfessional: null,
    confidence: 0.45,
    notes: "Catégorie à confirmer.",
  };
}


async function saveAirbnbReportLines(documentId, analysis) {
  const lines = analysis.airbnbLines || [];

  if (!lines.length) return 0;

  const year = analysis.periodStart ? Number(analysis.periodStart.slice(0, 4)) : null;

  // Rapport Airbnb annuel/global :
  // on remplace les anciennes lignes de la même année pour éviter de cumuler
  // plusieurs exports progressifs du type 01/01 → aujourd’hui.
  if (year && analysis.property === "Global Airbnb") {
    const { error: deleteYearError } = await supabase
      .from("airbnb_report_lines")
      .delete()
      .eq("source_label", "Airbnb")
      .eq("document_year", year);

    if (deleteYearError) {
      console.warn("Anciennes lignes Airbnb non supprimées", deleteYearError);
      throw deleteYearError;
    }
  } else {
    // Rapport non global ou mono-logement : on remplace seulement les lignes liées au document.
    const { error: deleteDocError } = await supabase
      .from("airbnb_report_lines")
      .delete()
      .eq("document_id", documentId);

    if (deleteDocError) {
      console.warn("Anciennes lignes du document non supprimées", deleteDocError);
      throw deleteDocError;
    }
  }

  const rows = lines.map((line) => ({
    document_id: documentId,
    source_label: "Airbnb",
    mapped_property: line.mappedProperty,
    raw_airbnb_label: line.rawLabel,

    period_start: analysis.periodStart || null,
    period_end: analysis.periodEnd || null,
    document_year: analysis.periodStart ? Number(analysis.periodStart.slice(0, 4)) : null,
    document_month: analysis.periodStart ? Number(analysis.periodStart.slice(5, 7)) : null,

    amount_gross: line.gross || 0,
    amount_adjustments: line.adjustments || 0,
    amount_fees: line.fees || 0,
    amount_tax_withheld: line.taxWithheld || 0,
    amount_net: line.net || 0,

    nights: line.nights || 0,
    average_stay: line.averageStay || 0,
    net_per_night: line.nights ? (line.net || 0) / line.nights : 0,

    notes: line.notes || null,
  }));

  const { error } = await supabase.from("airbnb_report_lines").insert(rows);

  if (error) {
    console.warn("Lignes Airbnb non enregistrées", error);
    throw error;
  }

  return rows.length;
}

async function analyzeFile(file) {
  const empty = {
    category: "",
    source: "",
    property: "",
    periodStart: "",
    periodEnd: "",
    amountIncome: 0,
    amountExpense: 0,
    amountTotal: 0,
    summary: "",
    airbnbLines: [],
  };

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return empty;

  const text = await extractPdfText(file);

    const bankRules = await loadBankCategoryRules();

    const amexAnalysis = parseAmericanExpressStatement(text, bankRules);
    if (amexAnalysis) return amexAnalysis;

    const bforAnalysis = parseBforBankStatement(text, bankRules);
    if (bforAnalysis) return bforAnalysis;

    const banquePopulaireAnalysis = parseBanquePopulaireStatement(text, bankRules);
    if (banquePopulaireAnalysis) return banquePopulaireAnalysis;

    const sgCreditDuNordAnalysis = parseSocieteGeneraleCreditDuNordStatement(text, bankRules);
    if (sgCreditDuNordAnalysis) return sgCreditDuNordAnalysis;

    const bankAnalysis = parseCreditAgricoleStatement(text, bankRules);
    if (bankAnalysis) return bankAnalysis;
  const normalized = normalizeText(text);

  if (normalized.includes("airbnb") && normalized.includes("rapport de revenus")) {
    return parseAirbnbReport(text);
  }

  return empty;
}

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }

  return pages.join("\n");
}

function parseAirbnbReport(text) {
  const clean = String(text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const normalized = normalizeText(clean);
  const euros = extractEuroValues(clean);

  const gross = euros[0] || 0;
  const adjustments = Math.abs(euros[1] || 0);
  const fees = Math.abs(euros[2] || 0);
  const net = euros[4] || 0;
  const period = parseFrenchPeriod(clean);

  const isGlobal =
    normalized.includes("logements") &&
    normalized.includes("types de revenus") &&
    (
      normalized.includes("chambre 1") ||
      normalized.includes("chambre 2") ||
      normalized.includes("wattignies") ||
      normalized.includes("logement entier")
    );

  const airbnbLines = isGlobal
    ? parseAirbnbPropertyLines(clean)
    : parseSingleAirbnbPropertyLine(clean, gross, adjustments, fees, net);

  const totalNights = airbnbLines.reduce((sum, line) => sum + (line.nights || 0), 0);
  const nights = totalNights || extractMainNights(clean);
  const netPerNight = nights && net ? net / nights : 0;

  const breakdownSummary = airbnbLines.length
    ? airbnbLines
        .map((line) => {
          const average = line.nights ? line.net / line.nights : 0;
          return `${line.mappedProperty} : net ${formatCurrency(line.net)}, nuits ${line.nights}, net/nuit ${formatCurrency(average)}`;
        })
        .join(" | ")
    : "";

  const summary = [
    "Analyse automatique Airbnb",
    isGlobal ? "Rapport global tous logements" : "",
    period.start && period.end ? `Période : ${period.start} → ${period.end}` : "",
    gross ? `Brut : ${formatCurrency(gross)}` : "",
    adjustments ? `Régularisations : ${formatCurrency(adjustments)}` : "",
    fees ? `Frais Airbnb : ${formatCurrency(fees)}` : "",
    net ? `Net : ${formatCurrency(net)}` : "",
    nights ? `Nuits : ${nights}` : "",
    netPerNight ? `Net/nuit : ${formatCurrency(netPerNight)}` : "",
    breakdownSummary ? `Répartition logements : ${breakdownSummary}` : "",
  ].filter(Boolean).join(" · ");

  return {
    category: "Airbnb",
    source: "Airbnb",
    property: isGlobal ? "Global Airbnb" : (airbnbLines[0]?.mappedProperty || ""),
    periodStart: period.start,
    periodEnd: period.end,
    amountIncome: gross,
    amountExpense: fees,
    amountTotal: net,
    summary,
    airbnbLines,
  };
}

function parseAirbnbPropertyLines(text) {
  const rawRows = [
    { raw: "Logement entier", mapped: "Melezio" },
    { raw: "Chambre côté jardin", mapped: "Melezio" },
    { raw: "Chambre côté rue", mapped: "Melezio" },
    { raw: "Chambre 1", mapped: "Fives" },
    { raw: "Chambre 2", mapped: "Fives" },
    { raw: "Chambre 3", mapped: "Fives" },
    { raw: "Chambre 4", mapped: "Fives" },
    { raw: "Wattignies", mapped: "Wattignies" },
  ];

  const aggregated = {};

  rawRows.forEach((row) => {
    const money = extractAirbnbMoneyRow(text, row.raw);
    const stats = extractAirbnbStatsRow(text, row.raw);

    if (!money && !stats) return;

    if (!aggregated[row.mapped]) {
      aggregated[row.mapped] = {
        mappedProperty: row.mapped,
        rawLabel: [],
        gross: 0,
        adjustments: 0,
        fees: 0,
        taxWithheld: 0,
        net: 0,
        nights: 0,
        averageStayWeightedTotal: 0,
      };
    }

    const target = aggregated[row.mapped];
    target.rawLabel.push(row.raw);

    if (money) {
      target.gross += money.gross;
      target.adjustments += Math.abs(money.adjustments);
      target.fees += Math.abs(money.fees);
      target.taxWithheld += Math.abs(money.taxWithheld);
      target.net += money.net;
    }

    if (stats) {
      target.nights += stats.nights;
      target.averageStayWeightedTotal += stats.averageStay * stats.nights;
    }
  });

  return Object.values(aggregated)
    .map((item) => ({
      mappedProperty: item.mappedProperty,
      rawLabel: item.rawLabel.join(" + "),
      gross: roundMoney(item.gross),
      adjustments: roundMoney(item.adjustments),
      fees: roundMoney(item.fees),
      taxWithheld: roundMoney(item.taxWithheld),
      net: roundMoney(item.net),
      nights: item.nights,
      averageStay: item.nights ? roundNumber(item.averageStayWeightedTotal / item.nights, 2) : 0,
      notes: `Mapping automatique depuis Airbnb : ${item.rawLabel.join(" + ")}`,
    }))
    .filter((item) => item.gross || item.net || item.nights);
}

function parseSingleAirbnbPropertyLine(text, gross, adjustments, fees, net) {
  const normalized = normalizeText(text);
  let mappedProperty = "";

  if (normalized.includes("wattignies")) mappedProperty = "Wattignies";
  else if (normalized.includes("chambre 1") || normalized.includes("chambre 2") || normalized.includes("chambre 3") || normalized.includes("chambre 4")) mappedProperty = "Fives";
  else if (normalized.includes("logement entier") || normalized.includes("chambre cote jardin") || normalized.includes("chambre cote rue")) mappedProperty = "Melezio";

  if (!mappedProperty) return [];

  return [
    {
      mappedProperty,
      rawLabel: mappedProperty,
      gross,
      adjustments,
      fees,
      taxWithheld: 0,
      net,
      nights: extractMainNights(text),
      averageStay: 0,
      notes: "Rapport Airbnb mono-logement",
    },
  ];
}

function extractAirbnbMoneyRow(text, label) {
  const escaped = escapeRegExp(label);
  const regex = new RegExp(
    `${escaped}\\s+(-?[\\d\\s]+,\\d{2})\\s*€\\s+(-?[\\d\\s]+,\\d{2})\\s*€\\s+(-?[\\d\\s]+,\\d{2})\\s*€\\s+(-?[\\d\\s]+,\\d{2})\\s*€\\s+(-?[\\d\\s]+,\\d{2})\\s*€`,
    "i"
  );

  const match = text.match(regex);
  if (!match) return null;

  return {
    gross: parseEuro(match[1]),
    adjustments: parseEuro(match[2]),
    fees: parseEuro(match[3]),
    taxWithheld: parseEuro(match[4]),
    net: parseEuro(match[5]),
  };
}

function extractAirbnbStatsRow(text, label) {
  const escaped = escapeRegExp(label);
  const regex = new RegExp(`${escaped}\\s+(\\d+)\\s+(\\d+(?:[,.]\\d+)?)`, "i");
  const match = text.match(regex);

  if (!match) return null;

  return {
    nights: Number(match[1]) || 0,
    averageStay: Number(String(match[2]).replace(",", ".")) || 0,
  };
}

function extractMainNights(text) {
  const match = String(text || "").match(/Nuits réservées\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function parseFrenchPeriod(text) {
  const months = {
    janvier: "01",
    février: "02",
    fevrier: "02",
    mars: "03",
    avril: "04",
    mai: "05",
    juin: "06",
    juillet: "07",
    août: "08",
    aout: "08",
    septembre: "09",
    octobre: "10",
    novembre: "11",
    décembre: "12",
    decembre: "12",
  };

  const normalized = String(text || "").toLowerCase();
  const match = normalized.match(/(\d{1,2})\s+([a-zéûôîàèùç]+)\s+(20\d{2})\s*[–-]\s*(\d{1,2})\s+([a-zéûôîàèùç]+)\s+(20\d{2})/i);

  if (!match) return { start: "", end: "" };

  return {
    start: `${match[3]}-${months[match[2]] || "01"}-${match[1].padStart(2, "0")}`,
    end: `${match[6]}-${months[match[5]] || "01"}-${match[4].padStart(2, "0")}`,
  };
}

function extractEuroValues(text) {
  return [...String(text || "").matchAll(/-?[\d\s]+,\d{2}\s*€/g)]
    .map((match) => parseEuro(match[0]))
    .filter((value) => Number.isFinite(value));
}

function parseEuro(value) {
  const cleaned = String(value || "")
    .replace(/\s/g, "")
    .replace("€", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

async function fileHash(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeFileName(fileName) {
  return String(fileName || "document")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundNumber(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}

const styles = `
.hiddenLegacyBubble { display: none !important; }

.smartUploadBubble {
  position: fixed;
  right: 18px;
  bottom: 82px;
  z-index: 9998;
  border: 0;
  border-radius: 999px;
  padding: 12px 16px;
  background: #8a6a4f;
  color: white;
  box-shadow: 0 18px 40px rgba(31,77,58,.24);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 950;
  cursor: pointer;
}

.smartUploadPanel {
  position: fixed;
  right: 14px;
  bottom: 142px;
  z-index: 10001;
  width: min(440px, calc(100vw - 28px));
  background: rgba(255,255,255,.97);
  border: 1px solid rgba(31,77,58,.14);
  border-radius: 28px;
  box-shadow: 0 24px 70px rgba(31,77,58,.22);
  overflow: hidden;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.smartUploadHeader {
  background: linear-gradient(135deg, #8a6a4f, #b48a64);
  color: white;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.smartUploadHeader p {
  margin: 0 0 4px;
  color: rgba(255,255,255,.78);
  text-transform: uppercase;
  letter-spacing: .12em;
  font-size: 11px;
  font-weight: 950;
}

.smartUploadHeader h2 {
  margin: 0;
  font-size: 24px;
}

.smartUploadHeader button {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 0;
  background: rgba(255,255,255,.18);
  color: white;
  font-size: 24px;
  cursor: pointer;
}

.smartUploadBody {
  padding: 16px;
}

.smartUploadIntro,
.smartUploadMini {
  color: #6d6257;
  line-height: 1.4;
}

.smartUploadDrop {
  display: grid;
  gap: 8px;
  margin: 14px 0;
  background: linear-gradient(135deg, #fff4d8, #fffaf0);
  border-radius: 20px;
  padding: 16px;
  border: 2px dashed rgba(138,106,79,.25);
  color: #1f4d3a;
  font-weight: 950;
}

.smartUploadFiles {
  display: grid;
  gap: 6px;
  background: #f7f4ef;
  border-radius: 16px;
  padding: 12px;
  color: #1f4d3a;
  margin-bottom: 12px;
}

.smartUploadFiles span {
  color: #6d6257;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.smartUploadSubmit {
  width: 100%;
  border: 0;
  border-radius: 18px;
  background: #1f4d3a;
  color: white;
  padding: 15px;
  font-weight: 950;
  font-size: 16px;
  cursor: pointer;
}

.smartUploadMessage {
  background: rgba(31,77,58,.08);
  color: #1f4d3a;
  border-radius: 14px;
  padding: 10px;
  font-weight: 850;
}
`;
