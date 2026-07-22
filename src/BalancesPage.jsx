import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  calculateCleanerBalances,
  DEFAULT_HOURLY_RATE,
  DEFAULT_LINEN_RATE,
} from "./services/cleanerBalanceService";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTWc95CaKrduwyhwg3t4LlfjLDI85oPVOA0v1_Dab6C5b1DX_WmgU5vWAGpsJ4oVcED011gqTsxLIWh/pub?output=csv";

export default function BalancesPage() {
  const [source, setSource] = useState({ csvText: "", payments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(() => formatInputDate(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [sheetResponse, paymentsResult] = await Promise.all([
        fetch(SHEET_CSV_URL, { cache: "no-store" }),
        supabase.from("cleaner_payments").select("cleaner_name, amount, payment_date, note"),
      ]);

      if (!sheetResponse.ok) throw new Error(`Google Sheets a répondu ${sheetResponse.status}`);
      if (paymentsResult.error) throw paymentsResult.error;

      const csvText = await sheetResponse.text();
      setSource({ csvText, payments: paymentsResult.data || [] });
      setUpdatedAt(new Date());
    } catch (loadError) {
      console.error("Erreur de rapprochement des balances", loadError);
      setError(`Impossible de calculer les soldes : ${loadError.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Loading on mount is the intended external synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const rows = useMemo(() => calculateCleanerBalances(source.csvText, source.payments, {
    startDate: startDate || null,
    endDate: endDate || null,
  }), [source, startDate, endDate]);

  const totals = useMemo(() => ({
    due: rows.reduce((sum, row) => sum + row.total_due, 0),
    paid: rows.reduce((sum, row) => sum + row.total_paid, 0),
    balance: rows.reduce((sum, row) => sum + row.balance, 0),
  }), [rows]);

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Balances</p>
        <h2>Soldes en temps réel</h2>
        <p className="muted">
          Depuis le dernier virement noté « solde » de chaque personne : heures Google Sheets × {DEFAULT_HOURLY_RATE} €/h,
          linge × {DEFAULT_LINEN_RATE} €, achats remboursables, moins les virements suivants.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "18px 0" }}>
          <label>
            Date début (facultative)
            <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            Date fin
            <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
        <button className="primary" onClick={load} disabled={loading}>
          {loading ? "Actualisation…" : "Actualiser les soldes"}
        </button>
        {updatedAt && <p className="muted">Mis à jour à {updatedAt.toLocaleTimeString("fr-FR")}</p>}
        {error && <p className="message">{error}</p>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 25 }}>
        <Card title="Total dû" value={`${totals.due.toFixed(2)} €`} />
        <Card title="Total payé" value={`${totals.paid.toFixed(2)} €`} color="#2e7d32" />
        <Card title="À payer" value={`${totals.balance.toFixed(2)} €`} color="#d32f2f" />
      </div>

      <div className="card">
        {!loading && !error && rows.length === 0 && <p>Aucune heure ni aucun virement trouvé.</p>}
        {rows.length > 0 && (
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th align="left">Femme de ménage</th>
                <th align="right">Heures</th>
                <th align="right">Total dû</th>
                <th align="right">Total payé</th>
                <th align="right">Solde</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.cleaner_name}>
                  <td><strong>{row.cleaner_name}</strong></td>
                  <td align="right">{row.total_hours.toFixed(2)} h</td>
                  <td align="right">{row.total_due.toFixed(2)} €</td>
                  <td align="right" style={{ color: "#2e7d32" }}>{row.total_paid.toFixed(2)} €</td>
                  <td align="right" style={{ color: row.balance > 0 ? "#d32f2f" : "#2e7d32", fontWeight: 700, fontSize: 18 }}>
                    {row.balance.toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function formatInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Card({ title, value, color = "#1f4d3a" }) {
  return (
    <div className="card" style={{ margin: 0, padding: 20 }}>
      <div style={{ fontSize: 13, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 34, fontWeight: 800, color, marginTop: 8 }}>{value}</div>
    </div>
  );
}
