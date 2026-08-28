import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  employeeHoursSummary,
  formatDuration,
  groupInterventionsByDay,
  recordedTimeLabel,
  reportPeriod,
} from "./employeeProjection";

const money = (value = 0) => new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
}).format(Number(value) || 0);

function statusLabel(status) {
  const labels = {
    validated: "Validée",
    completed: "Terminée",
    recorded: "Enregistrée",
    pending: "À vérifier",
  };
  return labels[status] || status || "Enregistrée";
}

export function HoursReport({ entries, title = "Rapport d’heures", subtitle }) {
  const [periodKind, setPeriodKind] = useState("WEEK");
  const [monthOffset, setMonthOffset] = useState(0);
  const reference = useMemo(() => new Date(), []);
  const summary = useMemo(() => employeeHoursSummary(entries, reference), [entries, reference]);
  const period = useMemo(() => (
    periodKind === "WEEK"
      ? reportPeriod("CURRENT_WEEK", reference)
      : reportPeriod("MONTH", reference, monthOffset)
  ), [periodKind, monthOffset, reference]);
  const days = useMemo(() => groupInterventionsByDay(entries, period), [entries, period]);
  const periodTotal = useMemo(
    () => days.reduce((sum, day) => sum + day.totalMinutes, 0),
    [days],
  );

  function showMonth(offset) {
    setPeriodKind("MONTH");
    setMonthOffset(offset);
  }

  return <section className="employeeHoursReport" aria-labelledby="hours-report-title">
    <div className="hoursReportHeading">
      <div>
        <p className="privateEyebrow">HEURES · SOURCE MÉNAGE</p>
        <h2 id="hours-report-title">{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <p className="hoursAuthorityNote">Calculé depuis les interventions autoritaires enregistrées. Les heures annulées sont exclues.</p>
    </div>

    <div className="privateMetricGrid employeeMetricGrid hoursSummary" aria-label="Résumé des heures">
      <article><strong>{formatDuration(summary.today)}</strong><span>aujourd’hui</span></article>
      <article><strong>{formatDuration(summary.week)}</strong><span>semaine en cours</span></article>
      <article><strong>{formatDuration(summary.month)}</strong><span>mois en cours</span></article>
    </div>

    <nav className="hoursPeriodNav" aria-label="Période du rapport">
      <div className="privateSegmented">
        <button
          className={periodKind === "WEEK" ? "active" : ""}
          aria-pressed={periodKind === "WEEK"}
          onClick={() => setPeriodKind("WEEK")}
        >Cette semaine</button>
        <button
          className={periodKind === "MONTH" && monthOffset === 0 ? "active" : ""}
          aria-pressed={periodKind === "MONTH" && monthOffset === 0}
          onClick={() => showMonth(0)}
        >Ce mois</button>
        <button
          className={periodKind === "MONTH" && monthOffset === -1 ? "active" : ""}
          aria-pressed={periodKind === "MONTH" && monthOffset === -1}
          onClick={() => showMonth(-1)}
        >Mois précédent</button>
      </div>
      {periodKind === "MONTH" && <div className="monthHistoryControls" aria-label="Navigation dans l’historique mensuel">
        <button onClick={() => setMonthOffset((offset) => offset - 1)} aria-label="Afficher le mois précédent">←</button>
        <strong>{period.label}</strong>
        <button
          onClick={() => setMonthOffset((offset) => Math.min(0, offset + 1))}
          disabled={monthOffset >= 0}
          aria-label="Afficher le mois suivant"
        >→</button>
      </div>}
    </nav>

    {days.length === 0 && <div className="privateEmptyCard hoursEmptyState">
      <h3>Aucune heure enregistrée sur cette période.</h3>
      <p>Le rapport reste à zéro tant qu’aucune intervention Ménage autoritaire n’est présente.</p>
    </div>}

    <div className="hoursDailyReport">
      {days.map((day) => <article className="hoursDayCard" key={day.key}>
        <header>
          <div><span>{day.key}</span><h3>{day.label}</h3></div>
          <div className="dayTotal"><span>TOTAL DU JOUR</span><strong>{formatDuration(day.totalMinutes)}</strong></div>
        </header>
        <div className="dayInterventions">
          {day.interventions.map((item) => <div className="hoursIntervention" key={item.id}>
            <div className="interventionIdentity">
              <strong>{item.property || "Logement non précisé"}</strong>
              <span>{recordedTimeLabel(item.occurred_at)}</span>
            </div>
            <div className="interventionMeta">
              <span>{item.service_type || "Intervention"}</span>
              <span>{statusLabel(item.status)}</span>
            </div>
            <strong className="interventionDuration">{formatDuration(item.minutes)}</strong>
          </div>)}
        </div>
      </article>)}
    </div>

    <footer className="hoursPeriodTotal">
      <span>{period.totalLabel}</span>
      <strong>{formatDuration(periodTotal)}</strong>
    </footer>
  </section>;
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
          <div className="employeeCardDate"><strong>{new Date(item.occurred_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</strong><span>{recordedTimeLabel(item.occurred_at)}</span></div>
          <div className="employeeCardBody"><span className="statusPill">{statusLabel(item.status)}</span><h2>{item.property || "Lieu non précisé"}</h2><p>{item.service_type || "Ménage"} · {formatDuration(item.minutes)}</p></div>
        </article>)}
      </section>}

      {!loading && view === "HOURS" && <HoursReport
        entries={entries}
        title="Mes heures"
        subtitle="Votre relevé journalier, hebdomadaire et mensuel, sans exposer les données d’un autre membre de l’équipe."
      />}

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
  const [selectedProfileId, setSelectedProfileId] = useState(null);
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
    const nextProfiles = profileQuery.data || [];
    setProfiles(nextProfiles);
    setEntries(entryQuery.data || []);
    setPayments(paymentQuery.data || []);
    setSelectedProfileId((current) => current || nextProfiles.find((item) => item.active)?.id || null);
    setLoading(false);
  }

  useEffect(() => {
    // Owner projection is loaded once when the protected tab mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const byId = new Map(profiles.map((item) => [item.id, item.display_name]));
  const selectedProfile = profiles.find((item) => item.id === selectedProfileId);
  const selectedEntries = entries.filter((item) => item.employee_profile_id === selectedProfileId);

  return <main className="privatePage privateModuleScope ownerTeam" id="main-content">
    <header className="employeeHero"><div><p className="privateEyebrow">ÉQUIPE · PROJECTION PRIVÉE</p><h1>Suivi du personnel.</h1><p>Cette vue lit les registres Ménage et Virements existants. Le Balance global reste dans son module Owner.</p></div></header>
    {message && <p className="privateInlineMessage">{message}</p>}
    {loading && <div className="privateLoadingCard" role="status">Chargement de l’équipe…</div>}
    {!loading && <section className="privateMetricGrid employeeMetricGrid"><article><strong>{profiles.filter((item) => item.active).length}</strong><span>profils actifs</span></article><article><strong>{entries.length}</strong><span>ménages enregistrés</span></article><article><strong>{money(payments.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong><span>règlements visibles</span></article></section>}

    {!loading && profiles.length > 0 && <section className="ownerEmployeeDirectory" aria-labelledby="owner-employee-hours-heading">
      <div className="hoursReportHeading"><div><p className="privateEyebrow">DÉTAIL PAR EMPLOYÉ</p><h2 id="owner-employee-hours-heading">Relevés individuels</h2><p>Ouvrez un profil pour consulter exactement le même rapport journalier, hebdomadaire et mensuel.</p></div></div>
      <div className="employeeProfilePicker">
        {profiles.map((item) => {
          const itemEntries = entries.filter((entry) => entry.employee_profile_id === item.id);
          const monthTotal = employeeHoursSummary(itemEntries).month;
          return <button
            key={item.id}
            className={selectedProfileId === item.id ? "active" : ""}
            aria-pressed={selectedProfileId === item.id}
            onClick={() => setSelectedProfileId(item.id)}
          >
            <span>{item.display_name}</span>
            <strong>{formatDuration(monthTotal)} ce mois</strong>
          </button>;
        })}
      </div>
    </section>}

    {!loading && selectedProfile && <HoursReport
      entries={selectedEntries}
      title={`Heures de ${selectedProfile.display_name}`}
      subtitle="Vue de gestion Owner. L’employé connecté reste limité à son propre profil par le RPC serveur."
    />}

    {!loading && <section className="ownerTeamGrid"><article><h2>Ménages récents</h2>{entries.map((item) => <div className="teamRow" key={item.id}><span>{byId.get(item.employee_profile_id) || "Profil TEST"}<small>{item.property || "Ménage"} · {new Date(item.occurred_at).toLocaleDateString("fr-FR")}</small></span><strong>{formatDuration(item.minutes)}</strong></div>)}</article><article><h2>Règlements</h2>{payments.map((item) => <div className="teamRow" key={item.id}><span>{byId.get(item.employee_profile_id) || "Profil TEST"}<small>{new Date(`${item.payment_date}T12:00:00`).toLocaleDateString("fr-FR")}</small></span><strong>{money(item.amount)}</strong></div>)}</article></section>}
    {!loading && profiles.length === 0 && <div className="privateEmptyCard"><h2>Aucun compte Employé réel créé.</h2><p>Gaëlle, Jennifer et Rachida ne seront invitées qu’après un GO Owner distinct.</p></div>}
  </main>;
}
