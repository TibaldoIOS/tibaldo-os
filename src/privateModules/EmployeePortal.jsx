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
  const [balances, setBalances] = useState([]);
  const [view, setView] = useState("BALANCE");
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

    const [entryQuery, paymentQuery, balanceQuery] = await Promise.all([
      supabase.rpc("tibaldo_app_person_entries"),
      supabase.rpc("tibaldo_app_person_payments"),
      supabase.rpc("tibaldo_app_personnel_balances"),
    ]);

    if (entryQuery.error || paymentQuery.error || balanceQuery.error) {
      setMessage("Vos informations n’ont pas pu être chargées.");
      setLoading(false);
      return;
    }
    setEntries(normalizeEntries(entryQuery.data || []));
    setPayments(paymentQuery.data || []);
    setBalances(balanceQuery.data || []);
    setLoading(false);
  }

  useEffect(() => {
    // Remote projection load is intentionally tied to the authenticated identity.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  const balance = balances[0];

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
        <button className={view === "BALANCE" ? "active" : ""} onClick={() => setView("BALANCE")}>Mon solde</button>
        <button className={view === "CLEANING" ? "active" : ""} onClick={() => setView("CLEANING")}>Mes ménages</button>
        <button className={view === "HOURS" ? "active" : ""} onClick={() => setView("HOURS")}>Mes heures</button>
        <button className={view === "PAYMENTS" ? "active" : ""} onClick={() => setView("PAYMENTS")}>Mes paiements</button>
      </nav>
      {message && <p className="privateInlineMessage" role="status">{message}</p>}
      {loading && <div className="privateLoadingCard" role="status">Chargement de votre espace…</div>}

      {!loading && view === "BALANCE" && balance && <BalanceCards balance={balance} personal />}

      {!loading && view === "CLEANING" && <section className="employeeCards">
        {entries.length === 0 && <div className="privateEmptyCard"><h2>Aucun ménage enregistré.</h2><p>Cette vue reprend le registre Ménage existant ; elle ne crée pas un second planning.</p></div>}
        {entries.map((item) => <article className="employeeCard employeeProjectionCard" key={item.id}>
          <div className="employeeCardDate"><strong>{new Date(item.occurred_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</strong><span>Date de service</span></div>
          <div className="employeeCardBody"><span className="statusPill">{statusLabel(item.status)}</span>{item.mapping_status === "OWNER_REVIEW_REQUIRED" && <span className="reviewPill">À vérifier</span>}<h2>{item.property || "Sans logement requis"}</h2><p>{item.service_type || "Ménage"} · {formatDuration(item.minutes)} · {money(item.due_total_amount)}</p></div>
        </article>)}
      </section>}

      {!loading && view === "HOURS" && <HoursReport
        entries={entries}
        title="Mes heures"
        subtitle="Votre relevé journalier, hebdomadaire et mensuel, sans exposer les données d’un autre membre de l’équipe."
      />}

      {!loading && view === "PAYMENTS" && <section className="employeePayments">
        {balance && <BalanceCards balance={balance} personal />}
        <div className="employeeHistoryList">{payments.map((item) => <div key={item.id}><span>{new Date(`${item.payment_date}T12:00:00`).toLocaleDateString("fr-FR")}</span><strong>{money(item.amount)}</strong></div>)}</div>
      </section>}
    </main>
  );
}

export function OwnerTeamOverview() {
  const [profiles, setProfiles] = useState([]);
  const [balances, setBalances] = useState([]);
  const [entries, setEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(() => window.location.hash.match(/^#team\/([0-9a-f-]+)$/i)?.[1] || "");
  const [filters, setFilters] = useState({ property: "", type: "", status: "", start: "", end: "" });
  const [payment, setPayment] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), note: "", reference: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [profileQuery, entryQuery, paymentQuery, balanceQuery] = await Promise.all([
      supabase.from("tibaldo_app_employee_profiles").select("id, display_name, active, staff_key").in("staff_key", ["gaelle", "jennifer", "rachida"]).order("display_name"),
      supabase.rpc("tibaldo_app_person_entries"),
      supabase.rpc("tibaldo_app_person_payments"),
      supabase.rpc("tibaldo_app_personnel_balances"),
    ]);
    if (profileQuery.error || entryQuery.error || paymentQuery.error || balanceQuery.error) {
      setMessage("La projection Équipe n’est pas disponible.");
      setLoading(false);
      return;
    }
    const nextProfiles = profileQuery.data || [];
    setProfiles(nextProfiles);
    setEntries(normalizeEntries(entryQuery.data || []));
    setPayments(paymentQuery.data || []);
    setBalances(balanceQuery.data || []);
    setLoading(false);
  }

  useEffect(() => {
    // Owner projection is loaded once when the protected tab mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const selectedProfile = profiles.find((item) => item.id === selectedProfileId);
  const selectedBalance = balances.find((item) => item.person_id === selectedProfileId);
  const visibleEntries = entries.filter((item) => (!selectedProfileId || item.person_id === selectedProfileId)
    && (!filters.property || (item.property || "").toLowerCase().includes(filters.property.toLowerCase()))
    && (!filters.type || item.service_type === filters.type)
    && (!filters.status || item.mapping_status === filters.status)
    && (!filters.start || item.service_date >= filters.start)
    && (!filters.end || item.service_date <= filters.end));
  const visiblePayments = payments.filter((item) => !selectedProfileId || item.person_id === selectedProfileId);

  function openProfile(id) {
    setSelectedProfileId(id);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#team/${id}`);
  }

  function closeProfile() {
    setSelectedProfileId("");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#team`);
  }

  async function recordPayment(event) {
    event.preventDefault();
    setMessage("");
    const result = await supabase.rpc("tibaldo_app_record_payment", {
      target_person_id: selectedProfileId,
      payment_amount: Number(payment.amount),
      paid_on: payment.date,
      payment_note: payment.note,
      kind: "WAGE_PAYMENT",
      reference: payment.reference || null,
    });
    if (result.error) return setMessage(`Paiement non enregistré : ${result.error.message}`);
    setPayment((current) => ({ ...current, amount: "", note: "", reference: "" }));
    setMessage("Paiement enregistré dans le registre TEST. Aucun virement bancaire n’a été exécuté.");
    await load();
  }

  return <main className="privatePage privateModuleScope ownerTeam" id="main-content">
    <header className="employeeHero"><div><p className="privateEyebrow">ÉQUIPE · BÊTA PRIVÉE</p><h1>{selectedProfile ? selectedProfile.display_name : "Personnel & ménage."}</h1><p>Registre canonique des prestations, heures, linge, paiements et soldes calculés côté serveur.</p></div>{selectedProfile && <button className="privateTextButton" onClick={closeProfile}>← Vue globale</button>}</header>
    {message && <p className="privateInlineMessage">{message}</p>}
    {loading && <div className="privateLoadingCard" role="status">Chargement de l’équipe…</div>}
    {!loading && !selectedProfile && <section className="teamBalanceDirectory">{balances.map((item) => <button key={item.person_id} onClick={() => openProfile(item.person_id)}><span><strong>{item.display_name}</strong><small>{Number(item.total_hours).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h · {item.linen_pairs} jeux de linge</small></span><span><small>Reste à payer</small><strong>{money(item.balance)}</strong></span></button>)}</section>}

    {!loading && selectedBalance && <BalanceCards balance={selectedBalance} />}

    {!loading && <section className="teamFilters" aria-label="Filtres"><input aria-label="Logement" placeholder="Logement" value={filters.property} onChange={(e) => setFilters({ ...filters, property: e.target.value })}/><select aria-label="Type" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">Tous les types</option><option value="HOUSEKEEPING">Ménage</option><option value="LAUNDRY">Linge</option><option value="PURCHASE">Achat</option><option value="MISC_SERVICE">Mission</option></select><select aria-label="Statut" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Tous les statuts</option><option value="MAPPED">Rapproché</option><option value="NO_PROPERTY_REQUIRED">Sans logement requis</option><option value="OWNER_REVIEW_REQUIRED">À vérifier</option></select><input aria-label="Début" type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })}/><input aria-label="Fin" type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })}/></section>}

    {!loading && <section className="ownerTeamGrid"><article><h2>Prestations ({visibleEntries.length})</h2>{visibleEntries.map((item) => <div className="teamRow" key={item.id}><span>{item.property || "Sans logement requis"}{item.mapping_status === "OWNER_REVIEW_REQUIRED" && <em className="reviewPill">À vérifier</em>}<small>{new Date(`${item.service_date}T12:00:00`).toLocaleDateString("fr-FR")} · {item.service_type} · {item.linen_pairs || 0} linge</small></span><strong>{formatDuration(item.minutes)}<small>{money(item.due_total_amount)}</small></strong></div>)}</article><article><h2>Paiements ({visiblePayments.length})</h2>{visiblePayments.map((item) => <div className="teamRow" key={item.id}><span>{item.note || item.payment_kind}<small>{new Date(`${item.payment_date}T12:00:00`).toLocaleDateString("fr-FR")}</small></span><strong>{money(item.amount)}</strong></div>)}</article></section>}

    {!loading && selectedProfile && <form className="paymentAction" onSubmit={recordPayment}><div><p className="privateEyebrow">ACTION OWNER · TEST UNIQUEMENT</p><h2>Enregistrer un paiement effectué</h2><p>Cette action ajoute une écriture au registre. Elle ne déclenche aucun paiement réel.</p></div><label>Montant (€)<input required min="0.01" step="0.01" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })}/></label><label>Date<input required type="date" value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })}/></label><label>Note<input value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })}/></label><label>Référence<input value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })}/></label><button className="privatePrimaryAction" type="submit">Enregistrer</button></form>}
    {!loading && profiles.length === 0 && <div className="privateEmptyCard"><h2>Aucun compte Employé réel créé.</h2><p>Gaëlle, Jennifer et Rachida ne seront invitées qu’après un GO Owner distinct.</p></div>}
  </main>;
}

function normalizeEntries(entries) {
  return entries.map((item) => ({ ...item, occurred_at: item.source_submitted_at || `${item.service_date}T12:00:00` }));
}

function BalanceCards({ balance, personal = false }) {
  return <section className="privateMetricGrid balanceMetricGrid" aria-label={personal ? "Mon solde" : "Solde du profil"}><article><strong>{money(balance.total_due)}</strong><span>Total dû</span></article><article><strong>{money(balance.wage_payments_included)}</strong><span>Paiements inclus</span></article><article className="metricAlert"><strong>{money(balance.balance)}</strong><span>Reste à payer</span></article><article><strong>{Number(balance.total_hours).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</strong><span>{balance.linen_pairs} jeux de linge</span></article></section>;
}
