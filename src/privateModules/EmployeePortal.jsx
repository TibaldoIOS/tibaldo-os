import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { formatDuration, minutesInPeriod } from "./employeeProjection";

const money = (value = 0) => new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
}).format(Number(value) || 0);

function periodStarts(now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const week = new Date(today); week.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const month = new Date(today.getFullYear(), today.getMonth(), 1);
  return { today, week, month };
}

export function EmployeePortal({ session }) {
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [view, setView] = useState("CLEANING");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setMessage("");
    const profileQuery = await supabase
      .from("tibaldo_app_employee_profiles")
      .select("id, user_id, display_name, active")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profileQuery.error || !profileQuery.data?.active) {
      setMessage("Aucun profil Personnel actif n’est rattaché à ce compte.");
      setLoading(false);
      return;
    }
    setProfile(profileQuery.data);

    const [entryQuery, paymentQuery] = await Promise.all([
      supabase.rpc("tibaldo_app_read_housekeeping"),
      supabase.rpc("tibaldo_app_read_payments"),
    ]);

    if (entryQuery.error || paymentQuery.error) {
      setMessage("Vos informations n’ont pas pu être chargées.");
      setLoading(false);
      return;
    }
    setEntries(entryQuery.data || []);
    setPayments(paymentQuery.data || []);
    setLoading(false);
  }

  useEffect(() => {
    // Remote projection load is intentionally tied to the authenticated identity.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  const hours = useMemo(() => {
    const now = new Date();
    const starts = periodStarts(now);
    return {
      today: minutesInPeriod(entries, starts.today, now),
      week: minutesInPeriod(entries, starts.week, now),
      month: minutesInPeriod(entries, starts.month, now),
    };
  }, [entries]);

  const totalPaid = useMemo(() => payments.reduce((sum, item) => sum + Number(item.amount || 0), 0), [payments]);

  return (
    <main className="privatePage privateModuleScope employeePortal" id="main-content">
      <header className="employeeHero">
        <div>
          <p className="privateEyebrow">ESPACE PERSONNEL</p>
          <h1>{profile ? `Bonjour ${profile.display_name}.` : "Votre espace."}</h1>
          <p>Vos ménages, vos heures enregistrées et vos règlements — uniquement les vôtres.</p>
        </div>
      </header>

      <nav className="privateSegmented employeeNav" aria-label="Espace personnel">
        <button className={view === "CLEANING" ? "active" : ""} onClick={() => setView("CLEANING")}>Mes ménages</button>
        <button className={view === "HOURS" ? "active" : ""} onClick={() => setView("HOURS")}>Mes heures</button>
        <button className={view === "PAYMENTS" ? "active" : ""} onClick={() => setView("PAYMENTS")}>Mes paiements</button>
      </nav>
      {message && <p className="privateInlineMessage" role="status">{message}</p>}
      {loading && <div className="privateLoadingCard" role="status">Chargement de votre espace…</div>}

      {!loading && view === "CLEANING" && <section className="employeeCards">
        {entries.length === 0 && <div className="privateEmptyCard"><h2>Aucun ménage enregistré.</h2><p>Cette vue reprend le registre Ménage existant ; elle ne crée pas un second planning.</p></div>}
        {entries.map((item) => <article className="employeeCard employeeProjectionCard" key={item.id}>
          <div className="employeeCardDate"><strong>{new Date(item.occurred_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</strong><span>{new Date(item.occurred_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div>
          <div className="employeeCardBody"><span className="statusPill">{item.status || "validé"}</span><h2>{item.property || "Lieu non précisé"}</h2><p>{item.service_type || "Ménage"} · {formatDuration(item.minutes)}</p></div>
        </article>)}
      </section>}

      {!loading && view === "HOURS" && <section className="employeeHours">
        <div className="privateMetricGrid employeeMetricGrid">
          <article><strong>{formatDuration(hours.today)}</strong><span>aujourd’hui</span></article>
          <article><strong>{formatDuration(hours.week)}</strong><span>semaine en cours</span></article>
          <article><strong>{formatDuration(hours.month)}</strong><span>mois en cours</span></article>
        </div>
        <div className="employeeHistoryList">{entries.map((item) => <div key={item.id}><span>{new Date(item.occurred_at).toLocaleDateString("fr-FR")} · {item.property || "Ménage"}</span><strong>{formatDuration(item.minutes)}</strong></div>)}</div>
      </section>}

      {!loading && view === "PAYMENTS" && <section className="employeePayments">
        <div className="privateMetricGrid employeeMetricGrid"><article><strong>{money(totalPaid)}</strong><span>règlements enregistrés</span></article></div>
        <p className="projectionNotice">Le montant dû et le reste à payer ne sont pas affichés tant que le calcul Google Sheets du Balance Owner n’est pas disponible via une projection serveur sûre.</p>
        <div className="employeeHistoryList">{payments.map((item) => <div key={item.id}><span>{new Date(`${item.payment_date}T12:00:00`).toLocaleDateString("fr-FR")}</span><strong>{money(item.amount)}</strong></div>)}</div>
      </section>}
    </main>
  );
}

export function OwnerTeamOverview() {
  const [profiles, setProfiles] = useState([]);
  const [entries, setEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [profileQuery, entryQuery, paymentQuery] = await Promise.all([
      supabase.from("tibaldo_app_employee_profiles").select("id, display_name, active").order("display_name"),
      supabase.rpc("tibaldo_app_read_housekeeping"),
      supabase.rpc("tibaldo_app_read_payments"),
    ]);
    if (profileQuery.error || entryQuery.error || paymentQuery.error) {
      setMessage("La projection Équipe n’est pas disponible.");
      setLoading(false);
      return;
    }
    setProfiles(profileQuery.data || []);
    setEntries(entryQuery.data || []);
    setPayments(paymentQuery.data || []);
    setLoading(false);
  }

  useEffect(() => {
    // Owner projection is loaded once when the protected tab mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const byId = new Map(profiles.map((item) => [item.id, item.display_name]));
  return <main className="privatePage privateModuleScope ownerTeam" id="main-content">
    <header className="employeeHero"><div><p className="privateEyebrow">ÉQUIPE · PROJECTION PRIVÉE</p><h1>Suivi du personnel.</h1><p>Cette vue lit les registres Ménage et Virements existants. Le Balance global reste dans son module Owner.</p></div></header>
    {message && <p className="privateInlineMessage">{message}</p>}
    {loading && <div className="privateLoadingCard" role="status">Chargement de l’équipe…</div>}
    {!loading && <section className="privateMetricGrid employeeMetricGrid"><article><strong>{profiles.filter((item) => item.active).length}</strong><span>profils actifs</span></article><article><strong>{entries.length}</strong><span>ménages récents</span></article><article><strong>{money(payments.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong><span>règlements visibles</span></article></section>}
    {!loading && <section className="ownerTeamGrid"><article><h2>Ménages récents</h2>{entries.map((item) => <div className="teamRow" key={item.id}><span>{byId.get(item.employee_profile_id) || "Profil TEST"}<small>{item.property || "Ménage"} · {new Date(item.occurred_at).toLocaleDateString("fr-FR")}</small></span><strong>{formatDuration(item.minutes)}</strong></div>)}</article><article><h2>Règlements</h2>{payments.map((item) => <div className="teamRow" key={item.id}><span>{byId.get(item.employee_profile_id) || "Profil TEST"}<small>{new Date(`${item.payment_date}T12:00:00`).toLocaleDateString("fr-FR")}</small></span><strong>{money(item.amount)}</strong></div>)}</article></section>}
    {!loading && profiles.length === 0 && <div className="privateEmptyCard"><h2>Aucun compte Employé réel créé.</h2><p>Gaëlle, Jennifer et Rachida ne seront invitées qu’après un GO Owner distinct.</p></div>}
  </main>;
}
