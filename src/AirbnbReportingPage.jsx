import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

export default function AirbnbReportingPage() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("contact@tibaldo.fr");
  const [password, setPassword] = useState("");
  const [lines, setLines] = useState([]);
  const [message, setMessage] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("Tous");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadLines();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) loadLines();
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

  async function loadLines() {
    const { data, error } = await supabase
      .from("airbnb_report_lines")
      .select("*")
      .order("mapped_property", { ascending: true });

    if (error) {
      setMessage("Erreur lecture Airbnb : " + error.message);
      return;
    }

    setLines(data || []);
  }

  const filteredLines = useMemo(() => {
    if (propertyFilter === "Tous") return lines;
    return lines.filter((line) => line.mapped_property === propertyFilter);
  }, [lines, propertyFilter]);

  const summary = useMemo(() => summarizeLines(filteredLines), [filteredLines]);
  const byProperty = useMemo(() => groupByProperty(filteredLines), [filteredLines]);

  if (!session) {
    return (
      <div className="airbnbReportPage">
        <div className="loginCard">
          <p className="eyebrow">Tibaldo OS</p>
          <h1>Reporting Airbnb</h1>
          <p>Connexion privée pour consulter les revenus Airbnb par logement.</p>

          <form onSubmit={signIn}>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>

            <label>
              Mot de passe
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>

            <button>Se connecter</button>
          </form>

          {message && <p className="message">{message}</p>}
        </div>

        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="airbnbReportPage">
      <header className="hero">
        <div>
          <p className="eyebrow">Tibaldo OS</p>
          <h1>Reporting Airbnb</h1>
          <p>Lecture directe de la table airbnb_report_lines : revenus, frais, net et nuits par logement.</p>
        </div>

        <button className="secondary" onClick={loadLines}>Rafraîchir</button>
      </header>

      {message && <p className="message">{message}</p>}

      <section className="filters">
        <label>
          Logement
          <select value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)}>
            <option>Tous</option>
            <option>Fives</option>
            <option>Melezio</option>
            <option>Wattignies</option>
          </select>
        </label>
      </section>

      <section className="kpiGrid">
        <Kpi label="Revenus bruts" value={formatCurrency(summary.gross)} />
        <Kpi label="Frais Airbnb" value={formatCurrency(summary.fees)} />
        <Kpi label="Net détecté" value={formatCurrency(summary.net)} />
        <Kpi label="Nuits" value={String(summary.nights)} />
        <Kpi label="Net / nuit" value={summary.nights ? formatCurrency(safeNetPerNight(summary.net, summary.nights)) : "—"} />
      </section>

      <section className="propertyGrid">
        {Object.entries(byProperty).map(([property, data]) => (
          <article className="propertyCard" key={property}>
            <p className="tag">{property}</p>
            <h2>{formatCurrency(data.net)}</h2>

            <div className="miniGrid">
              <span>
                <small>Brut</small>
                <strong>{formatCurrency(data.gross)}</strong>
              </span>
              <span>
                <small>Frais</small>
                <strong>{formatCurrency(data.fees)}</strong>
              </span>
              <span>
                <small>Nuits</small>
                <strong>{data.nights}</strong>
              </span>
              <span>
                <small>Net/nuit</small>
                <strong>{data.nights ? formatCurrency(safeNetPerNight(data.net, data.nights)) : "—"}</strong>
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="tableCard">
        <h2>Détail des lignes</h2>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Logement</th>
                <th>Libellé Airbnb</th>
                <th>Période</th>
                <th>Brut</th>
                <th>Frais</th>
                <th>Net</th>
                <th>Nuits</th>
                <th>Net/nuit</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.map((line) => (
                <tr key={line.id}>
                  <td>{line.mapped_property}</td>
                  <td>{line.raw_airbnb_label || "—"}</td>
                  <td>{line.period_start || "—"} → {line.period_end || "—"}</td>
                  <td>{formatCurrency(line.amount_gross)}</td>
                  <td>{formatCurrency(line.amount_fees)}</td>
                  <td>{formatCurrency(line.amount_net)}</td>
                  <td>{line.nights || 0}</td>
                  <td>{line.nights ? formatCurrency(safeNetPerNight(line.amount_net, line.nights)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredLines.length && <p>Aucune ligne Airbnb pour le moment.</p>}
      </section>

      <style>{styles}</style>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <article className="kpi">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function summarizeLines(lines) {
  return lines.reduce(
    (acc, line) => {
      acc.gross += Number(line.amount_gross) || 0;
      acc.fees += Number(line.amount_fees) || 0;
      acc.net += Number(line.amount_net) || 0;
      acc.nights += Number(line.nights) || 0;
      return acc;
    },
    { gross: 0, fees: 0, net: 0, nights: 0 }
  );
}

function groupByProperty(lines) {
  const grouped = {};

  lines.forEach((line) => {
    const property = line.mapped_property || "Non renseigné";

    if (!grouped[property]) {
      grouped[property] = { gross: 0, fees: 0, net: 0, nights: 0 };
    }

    grouped[property].gross += Number(line.amount_gross) || 0;
    grouped[property].fees += Number(line.amount_fees) || 0;
    grouped[property].net += Number(line.amount_net) || 0;
    grouped[property].nights += Number(line.nights) || 0;
  });

  return grouped;
}

function safeNetPerNight(net, nights) {
  const n = Number(net) || 0;
  const count = Number(nights) || 0;

  if (!count) return 0;

  return n / count;
}

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}

const styles = `
* { box-sizing: border-box; }

body { margin: 0; }

.airbnbReportPage {
  min-height: 100vh;
  padding: 16px;
  background:
    radial-gradient(circle at top left, rgba(126,226,168,.16), transparent 34%),
    radial-gradient(circle at bottom right, rgba(255,209,102,.20), transparent 36%),
    linear-gradient(135deg, #f7f4ef 0%, #eef8f2 100%);
  color: #1f4d3a;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.loginCard,
.hero,
.filters,
.tableCard {
  width: min(1180px, 100%);
  margin: 0 auto 14px;
  background: rgba(255,255,255,.9);
  border: 1px solid rgba(31,77,58,.10);
  border-radius: 28px;
  padding: 20px;
  box-shadow: 0 18px 44px rgba(31,77,58,.08);
}

.loginCard {
  max-width: 460px;
  margin-top: 8vh;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
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
  font-size: clamp(36px, 7vw, 62px);
  line-height: .95;
}

h2 { margin: 0 0 12px; }

p {
  color: #6d6257;
  line-height: 1.45;
}

button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.loginCard button,
.secondary {
  border-radius: 18px;
  padding: 13px 16px;
  font-weight: 950;
  background: #1f4d3a;
  color: white;
}

label {
  display: grid;
  gap: 8px;
  margin: 14px 0;
  color: #1f4d3a;
  font-weight: 950;
}

input,
select {
  width: 100%;
  border: 1px solid rgba(31,77,58,.16);
  border-radius: 18px;
  padding: 14px;
  font: inherit;
  background: white;
  color: #1f4d3a;
}

.message {
  width: min(1180px, 100%);
  margin: 0 auto 14px;
  background: white;
  border-radius: 18px;
  padding: 12px 14px;
  color: #1f4d3a;
  font-weight: 850;
}

.kpiGrid {
  width: min(1180px, 100%);
  margin: 0 auto 14px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.kpi,
.propertyCard {
  background: rgba(255,255,255,.9);
  border-radius: 24px;
  padding: 18px;
  box-shadow: 0 14px 34px rgba(31,77,58,.07);
}

.kpi p {
  margin: 0 0 8px;
  color: #8a6a4f;
  text-transform: uppercase;
  letter-spacing: .09em;
  font-size: 11px;
  font-weight: 950;
}

.kpi strong {
  display: block;
  font-size: 24px;
  color: #1f4d3a;
}

.propertyGrid {
  width: min(1180px, 100%);
  margin: 0 auto 14px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.tag {
  display: inline-block;
  margin: 0 0 10px;
  background: #1f4d3a;
  color: white;
  border-radius: 999px;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 950;
}

.propertyCard h2 {
  font-size: 32px;
}

.miniGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.miniGrid span {
  background: #f7f4ef;
  border-radius: 16px;
  padding: 12px;
}

.miniGrid small {
  display: block;
  color: #8a6a4f;
  text-transform: uppercase;
  font-size: 10px;
  font-weight: 950;
  margin-bottom: 4px;
}

.miniGrid strong {
  color: #1f4d3a;
}

.tableWrap {
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}

th,
td {
  text-align: left;
  border-bottom: 1px solid rgba(31,77,58,.10);
  padding: 12px 10px;
}

th {
  color: #8a6a4f;
  text-transform: uppercase;
  letter-spacing: .07em;
  font-size: 11px;
}

td {
  color: #1f4d3a;
  font-weight: 750;
}

@media (min-width: 760px) {
  .kpiGrid {
    grid-template-columns: repeat(5, 1fr);
  }

  .propertyGrid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 760px) {
  .hero {
    flex-direction: column;
  }

  .secondary {
    width: 100%;
  }
}
`;
