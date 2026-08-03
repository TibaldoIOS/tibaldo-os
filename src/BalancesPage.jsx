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
    mode: "all",
    endDate: endDate || null,
  }), [source, endDate]);

  const totals = useMemo(() => ({
    due: rows.reduce((sum, row) => sum + row.total_due, 0),
    paid: rows.reduce((sum, row) => sum + row.total_paid, 0),
    balance: rows.reduce((sum, row) => sum + row.balance, 0),
  }), [rows]);

  return (
    <section className="page balancesPage">
      <div className="hero">
        <p className="eyebrow">Balances</p>
        <h2>Soldes en temps réel</h2>
        <p className="muted">
          {`Historique complet depuis le début : toutes les lignes du Sheet, tous les virements et les ajustements sont comptés. Heures Google Sheets × ${DEFAULT_HOURLY_RATE} €/h, linge × ${DEFAULT_LINEN_RATE} €, achats remboursables, moins les règlements.`}
        </p>
        <div className="balancesFilters">
          <label>
            Date fin
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
        <button className="primary" onClick={load} disabled={loading}>
          {loading ? "Actualisation…" : "Actualiser les soldes"}
        </button>
        {updatedAt && <p className="muted">Mis à jour à {updatedAt.toLocaleTimeString("fr-FR")}</p>}
        {error && <p className="message">{error}</p>}
      </div>

      <div className="balancesSummaryGrid">
        <Card title="Total dû" value={`${totals.due.toFixed(2)} €`} />
        <Card title="Virements et ajustements" value={`${totals.paid.toFixed(2)} €`} color="#2e7d32" />
        <Card title="À payer" value={`${totals.balance.toFixed(2)} €`} color="#d32f2f" />
      </div>

      <div className="card balancesResultsCard">
        {!loading && !error && rows.length === 0 && <p>Aucune heure ni aucun virement trouvé.</p>}
        {rows.length > 0 && (
          <>
            <div className="balancesTableWrap">
              <table className="balancesTable">
                <thead>
                  <tr>
                    <th align="left">Femme de ménage</th>
                    <th align="right">Heures</th>
                    <th align="right">Heures × {DEFAULT_HOURLY_RATE} €</th>
                    <th align="right">Linge</th>
                    <th align="right">Achats</th>
                    <th align="right">Total dû</th>
                    <th align="right">Virements et ajustements</th>
                    <th align="right">Reste à payer</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.cleaner_name}>
                      <td><strong>{row.cleaner_name}</strong></td>
                      <td align="right">{row.total_hours.toFixed(2)} h</td>
                      <td align="right">{row.labor_due.toFixed(2)} €</td>
                      <td align="right">{row.linen_due.toFixed(2)} €</td>
                      <td align="right">{row.purchases_due.toFixed(2)} €</td>
                      <td align="right">{row.total_due.toFixed(2)} €</td>
                      <td align="right" className="balancesPaidValue">{row.total_paid.toFixed(2)} €</td>
                      <td
                        align="right"
                        className={row.balance > 0 ? "balancesDueValue" : "balancesPaidValue"}
                      >
                        {row.balance.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="balancesMobileList">
              {rows.map((row) => (
                <article className="balanceMobileCard" key={row.cleaner_name}>
                  <div className="balanceMobileHeader">
                    <h3>{row.cleaner_name}</h3>
                    <div className={row.balance > 0 ? "balanceMobileAmount isDue" : "balanceMobileAmount isPaid"}>
                      <span>Reste à payer</span>
                      <strong>{row.balance.toFixed(2)} €</strong>
                    </div>
                  </div>
                  <div className="balanceMobileDetails">
                    <Metric label="Heures" value={`${row.total_hours.toFixed(2)} h`} />
                    <Metric label={`Heures × ${DEFAULT_HOURLY_RATE} €`} value={`${row.labor_due.toFixed(2)} €`} />
                    <Metric label="Linge" value={`${row.linen_due.toFixed(2)} €`} />
                    <Metric label="Achats" value={`${row.purchases_due.toFixed(2)} €`} />
                    <Metric label="Total dû" value={`${row.total_due.toFixed(2)} €`} />
                    <Metric label="Virements" value={`${row.total_paid.toFixed(2)} €`} paid />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
      <style>{balancesStyles}</style>
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
    <div className="card balanceSummaryCard" style={{ "--balance-card-color": color }}>
      <div className="balanceSummaryTitle">{title}</div>
      <div className="balanceSummaryValue">{value}</div>
    </div>
  );
}

function Metric({ label, value, paid = false }) {
  return (
    <div className={paid ? "balanceMobileMetric isPaid" : "balanceMobileMetric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const balancesStyles = `
.balancesPage {
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.balancesPage > *,
.balancesFilters > *,
.balancesSummaryGrid > * {
  min-width: 0;
}

.balancesFilters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 18px 0;
}

.balancesFilters label {
  flex: 1 1 220px;
  margin: 0;
}

.balancesSummaryGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 11px;
}

.balanceSummaryCard {
  margin: 0;
  padding: 20px;
}

.balanceSummaryTitle {
  color: #666;
  font-size: 13px;
}

.balanceSummaryValue {
  color: var(--balance-card-color);
  font-size: 34px;
  font-weight: 800;
  line-height: 1.1;
  margin-top: 8px;
  overflow-wrap: anywhere;
}

.balancesResultsCard {
  min-width: 0;
  max-width: 100%;
}

.balancesTableWrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.balancesTable {
  width: 100%;
  min-width: 820px;
  border-collapse: collapse;
}

.balancesTable th,
.balancesTable td {
  padding: 10px 8px;
  border-bottom: 1px solid rgba(31,77,58,.1);
  white-space: nowrap;
}

.balancesTable th {
  color: #1f4d3a;
  font-size: 13px;
  line-height: 1.25;
}

.balancesTable tbody tr:last-child td {
  border-bottom: 0;
}

.balancesPaidValue {
  color: #2e7d32;
  font-weight: 700;
}

.balancesDueValue {
  color: #d32f2f;
  font-size: 18px;
  font-weight: 700;
}

.balancesMobileList {
  display: none;
}

@media (max-width: 700px) {
  .balancesFilters {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .balancesFilters label {
    width: 100%;
  }

  .balancesSummaryGrid {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .balanceSummaryCard {
    padding: 17px;
  }

  .balanceSummaryValue {
    font-size: 30px;
  }

  .balancesResultsCard {
    padding: 10px;
  }

  .balancesTableWrap {
    display: none;
  }

  .balancesMobileList {
    display: grid;
    gap: 12px;
  }

  .balanceMobileCard {
    min-width: 0;
    padding: 15px;
    border-radius: 19px;
    background: #f7f4ef;
    border: 1px solid rgba(31,77,58,.08);
  }

  .balanceMobileHeader {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 13px;
    border-bottom: 1px solid rgba(31,77,58,.1);
  }

  .balanceMobileHeader h3 {
    margin: 3px 0 0;
    font-size: 20px;
  }

  .balanceMobileAmount {
    min-width: 0;
    text-align: right;
  }

  .balanceMobileAmount span {
    display: block;
    color: #6d6257;
    font-size: 11px;
    font-weight: 700;
  }

  .balanceMobileAmount strong {
    display: block;
    margin-top: 2px;
    font-size: 22px;
    line-height: 1.15;
  }

  .balanceMobileAmount.isDue strong {
    color: #d32f2f;
  }

  .balanceMobileAmount.isPaid strong {
    color: #2e7d32;
  }

  .balanceMobileDetails {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    padding-top: 13px;
  }

  .balanceMobileMetric {
    min-width: 0;
    padding: 10px;
    border-radius: 14px;
    background: rgba(255,255,255,.82);
  }

  .balanceMobileMetric span {
    display: block;
    color: #766b61;
    font-size: 11px;
    line-height: 1.2;
  }

  .balanceMobileMetric strong {
    display: block;
    margin-top: 5px;
    color: #1f4d3a;
    font-size: 15px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .balanceMobileMetric.isPaid strong {
    color: #2e7d32;
  }
}
`;
