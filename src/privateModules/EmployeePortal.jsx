import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const STATUS_LABELS = {
  PLANNED: "Planifié",
  CONFIRMED: "Confirmé",
  IN_PROGRESS: "En cours",
  COMPLETED_SUBMITTED: "Durée envoyée",
  VALIDATED: "Validé",
  CANCELLED: "Annulé",
};

const minutesToHours = (minutes = 0) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
const money = (cents = 0) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function EmployeePortal({ session }) {
  const [profile, setProfile] = useState(null);
  const [interventions, setInterventions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [view, setView] = useState("CLEANING");
  const [duration, setDuration] = useState({});
  const [message, setMessage] = useState("");

  async function load() {
    const profileQuery = await supabase
      .from("tibaldo_app_employee_profiles")
      .select("id, user_id, display_name, active")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (profileQuery.error) return setMessage(`Accès indisponible : ${profileQuery.error.message}`);
    if (!profileQuery.data) return setMessage("Aucun profil Employé actif n’est rattaché à ce compte.");
    setProfile(profileQuery.data);

    const [interventionQuery, paymentQuery] = await Promise.all([
      supabase.from("tibaldo_app_employee_interventions").select("*").eq("employee_profile_id", profileQuery.data.id).order("scheduled_at", { ascending: false }),
      supabase.from("tibaldo_app_employee_payments").select("*").eq("employee_profile_id", profileQuery.data.id).order("period_end", { ascending: false }),
    ]);
    if (interventionQuery.error || paymentQuery.error) return setMessage("Les informations Employé n’ont pas pu être chargées.");
    setInterventions(interventionQuery.data || []);
    setPayments(paymentQuery.data || []);
  }

  useEffect(() => {
    // Remote data is intentionally synchronized when the authenticated identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function submitDuration(intervention) {
    const value = Number(duration[intervention.id]);
    if (!Number.isInteger(value) || value < 1) return setMessage("Indique une durée réelle en minutes.");
    const result = await supabase.rpc("tibaldo_app_submit_intervention_duration", {
      intervention_id: intervention.id,
      duration_minutes: value,
    });
    if (result.error) return setMessage("La durée n’a pas pu être transmise.");
    setMessage("Durée envoyée à l’Owner pour validation.");
    await load();
  }

  const hours = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const minutes = (from) => interventions
      .filter((item) => new Date(item.scheduled_at) >= from && item.status !== "CANCELLED")
      .reduce((sum, item) => sum + (item.actual_duration_minutes || item.planned_duration_minutes), 0);
    return { week: minutes(weekAgo), month: minutes(monthStart) };
  }, [interventions]);

  const totals = useMemo(() => payments.reduce((result, item) => ({
    due: result.due + item.amount_due_cents,
    paid: result.paid + item.amount_paid_cents,
  }), { due: 0, paid: 0 }), [payments]);

  return (
    <main className="privatePage employeePortal" id="main-content">
      <header className="employeeHero">
        <div><p className="eyebrow">ESPACE PERSONNEL</p><h1>{profile ? `Bonjour ${profile.display_name}.` : "Votre espace."}</h1><p>Vos interventions, vos heures et vos paiements — rien de plus.</p></div>
      </header>
      <nav className="segmented employeeNav" aria-label="Espace personnel">
        <button className={view === "CLEANING" ? "active" : ""} onClick={() => setView("CLEANING")}>Mes ménages</button>
        <button className={view === "HOURS" ? "active" : ""} onClick={() => setView("HOURS")}>Mes heures</button>
        <button className={view === "PAYMENTS" ? "active" : ""} onClick={() => setView("PAYMENTS")}>Mes paiements</button>
      </nav>
      {message && <p className="inlineMessage" role="status">{message}</p>}

      {view === "CLEANING" && <section className="employeeCards">
        {interventions.length === 0 && <div className="emptyCard"><h2>Aucune intervention planifiée.</h2><p>Les nouvelles missions apparaîtront ici.</p></div>}
        {interventions.map((item) => <article className="employeeCard" key={item.id}>
          <div className="employeeCardDate"><strong>{new Date(item.scheduled_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</strong><span>{new Date(item.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div>
          <div className="employeeCardBody"><span className="statusPill">{STATUS_LABELS[item.status]}</span><h2>{item.property_name}</h2><p>Prévu : {minutesToHours(item.planned_duration_minutes)}</p>{item.operational_note && <p className="taskNote">{item.operational_note}</p>}</div>
          {!['VALIDATED', 'CANCELLED'].includes(item.status) && <div className="durationSubmit"><label>Durée réelle (minutes)<input type="number" min="1" max="1440" value={duration[item.id] || ""} onChange={(event) => setDuration({ ...duration, [item.id]: event.target.value })} /></label><button className="primaryAction" onClick={() => submitDuration(item)}>Envoyer ma durée</button></div>}
        </article>)}
      </section>}

      {view === "HOURS" && <section className="employeeHours">
        <div className="metricGrid"><article><strong>{minutesToHours(hours.week)}</strong><span>7 derniers jours</span></article><article><strong>{minutesToHours(hours.month)}</strong><span>mois en cours</span></article></div>
        <div className="historyList">{interventions.filter((item) => item.actual_duration_minutes).map((item) => <div key={item.id}><span>{new Date(item.scheduled_at).toLocaleDateString("fr-FR")} · {item.property_name}</span><strong>{minutesToHours(item.actual_duration_minutes)}</strong></div>)}</div>
      </section>}

      {view === "PAYMENTS" && <section className="employeePayments">
        <div className="metricGrid"><article><strong>{money(totals.due)}</strong><span>validé</span></article><article><strong>{money(totals.paid)}</strong><span>payé</span></article><article><strong>{money(totals.due - totals.paid)}</strong><span>reste</span></article></div>
        <div className="historyList">{payments.map((item) => <div key={item.id}><span>{new Date(`${item.period_start}T12:00:00`).toLocaleDateString("fr-FR")} → {new Date(`${item.period_end}T12:00:00`).toLocaleDateString("fr-FR")}</span><strong>{money(item.amount_paid_cents)} / {money(item.amount_due_cents)}</strong></div>)}</div>
      </section>}
    </main>
  );
}

export function OwnerTeamOverview() {
  const [profiles, setProfiles] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [message, setMessage] = useState("");

  async function load() {
    const [profileQuery, interventionQuery, paymentQuery] = await Promise.all([
      supabase.from("tibaldo_app_employee_profiles").select("id, display_name, active").order("display_name"),
      supabase.from("tibaldo_app_employee_interventions").select("id, employee_profile_id, property_name, scheduled_at, planned_duration_minutes, actual_duration_minutes, status").order("scheduled_at", { ascending: false }).limit(40),
      supabase.from("tibaldo_app_employee_payments").select("id, employee_profile_id, period_start, period_end, amount_due_cents, amount_paid_cents").order("period_end", { ascending: false }).limit(40),
    ]);
    if (profileQuery.error || interventionQuery.error || paymentQuery.error) return setMessage("La projection équipe n’est pas disponible.");
    setProfiles(profileQuery.data || []); setInterventions(interventionQuery.data || []); setPayments(paymentQuery.data || []);
  }

  useEffect(() => {
    // Remote owner projection is loaded once when this protected route mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);
  const byId = new Map(profiles.map((item) => [item.id, item.display_name]));

  return <main className="privatePage ownerTeam" id="main-content">
    <header className="employeeHero"><div><p className="eyebrow">ÉQUIPE · PROJECTION PRIVÉE</p><h1>Suivi du personnel.</h1><p>Cette vue n’utilise pas le Balance global et n’expose aucun autre salarié.</p></div></header>
    {message && <p className="inlineMessage">{message}</p>}
    <section className="metricGrid"><article><strong>{profiles.filter((item) => item.active).length}</strong><span>profils actifs</span></article><article><strong>{interventions.filter((item) => item.status === 'COMPLETED_SUBMITTED').length}</strong><span>durées à valider</span></article><article><strong>{payments.reduce((sum, item) => sum + item.amount_due_cents - item.amount_paid_cents, 0) / 100} €</strong><span>reste validé</span></article></section>
    <section className="ownerTeamGrid"><article><h2>Interventions récentes</h2>{interventions.map((item) => <div className="teamRow" key={item.id}><span>{byId.get(item.employee_profile_id) || "Profil TEST"}<small>{item.property_name}</small></span><strong>{STATUS_LABELS[item.status]}</strong></div>)}</article><article><h2>Paiements projetés</h2>{payments.map((item) => <div className="teamRow" key={item.id}><span>{byId.get(item.employee_profile_id) || "Profil TEST"}<small>{item.period_start} → {item.period_end}</small></span><strong>{money(item.amount_paid_cents)} / {money(item.amount_due_cents)}</strong></div>)}</article></section>
    {profiles.length === 0 && <div className="emptyCard"><h2>Aucun compte Employé réel créé.</h2><p>Les invitations de Gaëlle, Jennifer et Rachida restent soumises au GO Owner.</p></div>}
  </main>;
}
