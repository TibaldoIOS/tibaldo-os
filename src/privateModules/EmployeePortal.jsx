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
  const [portal, setPortal] = useState(null);
  const [view, setView] = useState("DASHBOARD");
  const [period, setPeriod] = useState("CURRENT_MONTH");
  const [search, setSearch] = useState("");
  const [property, setProperty] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [withLinen, setWithLinen] = useState(false);
  const [withOther, setWithOther] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    const now = new Date();
    if (period === "ALL") return { start: null, end: null };
    if (period === "CUSTOM") return { start: customStart || null, end: customEnd || null };
    if (period === "CURRENT_WEEK") {
      const start = new Date(now);
      const weekday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - weekday);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
    }
    const start = period === "PREVIOUS_MONTH"
      ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = period === "PREVIOUS_MONTH"
      ? new Date(now.getFullYear(), now.getMonth(), 0)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }, [customEnd, customStart, period]);

  async function load() {
    setLoading(true);
    setMessage("");
    const result = await supabase.rpc("tibaldo_app_employee_portal_v1", {
      period_start: range.start,
      period_end: range.end,
    });
    if (result.error || !result.data) {
      setMessage("Vos informations n’ont pas pu être chargées.");
      setLoading(false);
      return;
    }
    setPortal(result.data);
    setLoading(false);
  }

  useEffect(() => {
    // Remote projection load is intentionally tied to the authenticated identity.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id, range.start, range.end]);

  const entries = portal?.entries || [];
  const payments = portal?.payments || [];
  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const properties = [...new Set(entries.map((item) => item.property))].sort();
  const serviceTypes = [...new Set(entries.map((item) => item.service_type).filter(Boolean))].sort();
  const visibleEntries = entries.filter((item) => (!property || item.property === property)
    && (!serviceType || item.service_type === serviceType)
    && (!withLinen || Number(item.linen_pairs || 0) > 0)
    && (!withOther || Number(item.due_other || 0) > 0 || Boolean(item.mission))
    && (!normalizedSearch || [item.property, item.service_type, item.mission, item.remarks, item.service_date, formatDate(item.service_date)]
      .filter(Boolean).join(" ").toLocaleLowerCase("fr").includes(normalizedSearch)));
  const grouped = visibleEntries.reduce((result, item) => {
    (result[item.property] ||= []).push(item);
    return result;
  }, {});
  const history = [
    ...visibleEntries.map((item) => ({ date: item.service_date, kind: "entry", item })),
    ...payments.map((item) => ({ date: item.payment_date, kind: "payment", item })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const summary = portal?.period_summary;
  const balance = portal?.balance;

  return (
    <main className="privatePage privateModuleScope employeePortal" id="main-content">
      <header className="employeeHero">
        <div>
          <p className="privateEyebrow">ESPACE PERSONNEL</p>
          <h1>{portal ? `Bonjour ${portal.profile.display_name}.` : "Votre espace."}</h1>
          <p>Vos heures, prestations, paiements et solde — uniquement les vôtres.</p>
        </div>
        <button className="privatePrimaryAction employeeReportLink" onClick={() => setMessage("Notez la date et l’élément concerné, puis contactez directement le Owner. Aucune donnée n’a été modifiée.")}>Signaler une erreur</button>
      </header>

      <nav className="privateSegmented employeeNav" aria-label="Espace personnel">
        <button className={view === "DASHBOARD" ? "active" : ""} onClick={() => setView("DASHBOARD")}>Tableau de bord</button>
        <button className={view === "HOURS" ? "active" : ""} onClick={() => setView("HOURS")}>Heures & prestations</button>
        <button className={view === "PROPERTIES" ? "active" : ""} onClick={() => setView("PROPERTIES")}>Par logement</button>
        <button className={view === "PAYMENTS" ? "active" : ""} onClick={() => setView("PAYMENTS")}>Paiements</button>
        <button className={view === "HISTORY" ? "active" : ""} onClick={() => setView("HISTORY")}>Historique</button>
      </nav>
      <section className="employeeControls" aria-label="Période et recherche">
        <label>Période<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="CURRENT_WEEK">Cette semaine</option><option value="CURRENT_MONTH">Ce mois</option><option value="PREVIOUS_MONTH">Mois précédent</option><option value="ALL">Tout l’historique</option><option value="CUSTOM">Personnalisé</option></select></label>
        <label>Rechercher<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Logement, mission, remarque…" /></label>
        <label>Logement<select value={property} onChange={(event) => setProperty(event.target.value)}><option value="">Tous</option>{properties.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Type<select value={serviceType} onChange={(event) => setServiceType(event.target.value)}><option value="">Tous</option>{serviceTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        {period === "CUSTOM" && <><label>Du<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><label>Au<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></>}
        <label className="employeeCheck"><input type="checkbox" checked={withLinen} onChange={(event) => setWithLinen(event.target.checked)} /> Avec linge</label>
        <label className="employeeCheck"><input type="checkbox" checked={withOther} onChange={(event) => setWithOther(event.target.checked)} /> Autres / achats</label>
      </section>
      {message && <p className="privateInlineMessage" role="status">{message}</p>}
      {loading && <div className="privateLoadingCard" role="status">Chargement de votre espace…</div>}

      {!loading && view === "DASHBOARD" && summary && balance && <><section className="privateMetricGrid balanceMetricGrid"><article><strong>{formatDuration(summary.minutes)}</strong><span>Heures sur la période</span></article><article><strong>{money(summary.total_due)}</strong><span>Montant dû</span></article><article><strong>{money(summary.paid)}</strong><span>Montant payé</span></article><article className="metricAlert"><strong>{money(balance.current)}</strong><span>Reste à payer</span></article></section><section className="employeeSecondaryMetrics"><article><span>Linge</span><strong>{summary.linen_pairs} paire(s) · {money(summary.due_laundry)}</strong></article><article><span>Autres missions / frais</span><strong>{money(summary.due_other)}</strong></article></section><section className="balanceEquation" aria-label="Calcul du solde"><div><span>Total dû</span><strong>{money(balance.total_due)}</strong></div><i>−</i><div><span>Paiements pris en compte</span><strong>{money(balance.paid_and_adjustments)}</strong></div><i>=</i><div><span>Reste à payer</span><strong>{money(balance.current)}</strong></div></section><p className="projectionNotice">Le solde actuel porte sur tout l’historique. Les remboursements de frais ({money(balance.excluded_reimbursements)}) restent hors salaire.</p></>}

      {!loading && view === "HOURS" && <EntryList entries={visibleEntries} />}

      {!loading && view === "PROPERTIES" && <section className="propertyGroups">{Object.entries(grouped).map(([name, items]) => <article key={name} className={name === "Sans logement requis" ? "noPropertyGroup" : ""}><p className="privateEyebrow">{name === "Sans logement requis" ? "MISSIONS SANS LOGEMENT" : "LOGEMENT"}</p><h2>{name}</h2><div className="propertyMetrics"><span><b>{formatDuration(items.reduce((sum, item) => sum + Number(item.minutes || 0), 0))}</b> heures</span><span><b>{items.length}</b> prestations</span><span><b>{items.reduce((sum, item) => sum + Number(item.linen_pairs || 0), 0)}</b> linge</span><span><b>{money(items.reduce((sum, item) => sum + Number(item.due_other || 0), 0))}</b> autres</span><span><b>{money(items.reduce((sum, item) => sum + Number(item.total_due || 0), 0))}</b> total dû</span></div><button className="privateTextButton" onClick={() => { setProperty(name); setView("HOURS"); }}>Voir le détail chronologique</button></article>)}{Object.keys(grouped).length === 0 && <EmptyPeriod />}</section>}

      {!loading && view === "PAYMENTS" && <section className="employeePayments"><section className="privateMetricGrid balanceMetricGrid"><article><strong>{money(balance.total_due)}</strong><span>Total dû</span></article><article><strong>{money(balance.paid_and_adjustments)}</strong><span>Payé et ajustements</span></article><article className="metricAlert"><strong>{money(balance.current)}</strong><span>Reste à payer</span></article><article><strong>{money(balance.excluded_reimbursements)}</strong><span>Remboursements hors salaire</span></article></section><div className="employeeHistoryList">{payments.map((item, index) => <div className={item.kind === "LEGACY_ADJUSTMENT" ? "employeeAdjustment" : ""} key={`${item.payment_date}-${index}`}><span><b>{item.label}</b><small>{formatDate(item.payment_date)}{item.note ? ` · ${item.note}` : ""}</small></span><strong>{money(item.amount)}</strong></div>)}{payments.length === 0 && <EmptyPeriod />}</div></section>}

      {!loading && view === "HISTORY" && <section className="employeeHistoryList">{history.map(({ date, kind, item }, index) => <div key={`${date}-${kind}-${index}`}><span><b>{kind === "entry" ? item.property : item.label}</b><small>{formatDate(date)} · {kind === "entry" ? `${item.service_type || "Prestation"} · ${formatDuration(item.minutes)}` : (item.note || "Paiement")}</small></span><strong>{money(kind === "entry" ? item.total_due : item.amount)}</strong></div>)}{history.length === 0 && <EmptyPeriod />}</section>}
    </main>
  );
}

function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function EmptyPeriod() {
  return <div className="privateEmptyCard"><h2>Aucune donnée sur cette période.</h2><p>Essayez une autre période ou retirez un filtre.</p></div>;
}

function EntryList({ entries }) {
  if (entries.length === 0) return <EmptyPeriod />;
  return <section className="employeeCards">{entries.map((item, index) => <article className="employeeCard employeeProjectionCard" key={`${item.service_date}-${item.property}-${index}`}><div className="employeeCardDate"><strong>{formatDate(item.service_date)}</strong><span>{item.provenance}</span></div><div className="employeeCardBody"><span className="statusPill">{item.service_type || "Prestation"}</span><h2>{item.property}</h2><p>{formatDuration(item.minutes)} · {Number(item.linen_pairs || 0)} linge · {money(item.total_due)}</p>{Number(item.due_other || 0) > 0 && <p>Autre mission / achat : {money(item.due_other)}</p>}{item.mission && <p>{item.mission}</p>}{item.remarks && <details><summary>Voir la remarque</summary><p>{item.remarks}</p></details>}</div></article>)}</section>;
}

export function OwnerTeamOverview() {
  const [profiles, setProfiles] = useState([]);
  const [balances, setBalances] = useState([]);
  const [entries, setEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(() => window.location.hash.match(/^#team\/([0-9a-f-]+)$/i)?.[1] || "");
  const [filters, setFilters] = useState({ person: "", property: "", type: "", paymentStatus: "", start: "", end: "" });
  const [payment, setPayment] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), kind: "WAGE_PAYMENT", note: "", reference: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [profileQuery, entryQuery, paymentQuery, balanceQuery] = await Promise.all([
      supabase.from("tibaldo_app_employee_profiles").select("id, user_id, display_name, active, status, staff_key").in("staff_key", ["gaelle", "jennifer", "rachida"]).order("display_name"),
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
  const scopePersonId = selectedProfileId || filters.person;
  const visibleEntries = entries.filter((item) => (!scopePersonId || item.person_id === scopePersonId)
    && (!filters.property || propertyFilterKey(item) === filters.property)
    && (!filters.type || item.service_type === filters.type)
    && (!filters.start || item.service_date >= filters.start)
    && (!filters.end || item.service_date <= filters.end));
  const visiblePayments = payments.filter((item) => !scopePersonId || item.person_id === scopePersonId);
  const reviewEntries = entries.filter((item) => ["PROPERTY_REVIEW_REQUIRED", "OWNER_REVIEW_REQUIRED"].includes(item.mapping_status));
  const teamTotals = balances.reduce((total, item) => ({
    hours: total.hours + Number(item.total_hours || 0),
    linen: total.linen + Number(item.linen_pairs || 0),
    due: total.due + Number(item.total_due || 0),
    paid: total.paid + Number(item.wage_payments_included || 0),
    balance: total.balance + Number(item.balance || 0),
  }), { hours: 0, linen: 0, due: 0, paid: 0, balance: 0 });
  const directory = balances.filter((item) => (!filters.person || item.person_id === filters.person)
    && (!filters.paymentStatus || (filters.paymentStatus === "OUTSTANDING" ? Number(item.balance) > 0 : Number(item.balance) <= 0)));
  const ordinaryPayments = visiblePayments.filter((item) => item.payment_kind !== "LEGACY_ADJUSTMENT");
  const adjustments = visiblePayments.filter((item) => item.payment_kind === "LEGACY_ADJUSTMENT"
    || item.legacy_classification === "LEGACY_BALANCE_CORRECTION_ORIGIN_NOT_PROVEN");

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
      kind: payment.kind,
      reference: payment.reference || null,
    });
    if (result.error) return setMessage(`Paiement non enregistré : ${result.error.message}`);
    setPayment((current) => ({ ...current, amount: "", note: "", reference: "" }));
    setMessage("Paiement enregistré dans le registre TEST. Aucun virement bancaire n’a été exécuté.");
    await load();
  }

  async function decideProperty(entryId, decision) {
    setMessage("");
    const result = await supabase.rpc("tibaldo_app_resolve_property_mapping", {
      target_entry_id: entryId,
      owner_decision: decision,
      decision_reason: "Décision Owner depuis la file de revue privée",
      request_key: `owner-property:${entryId}:${decision}`,
    });
    if (result.error) return setMessage(`Décision non enregistrée : ${result.error.message}`);
    setMessage("Décision logement enregistrée et auditée dans TEST.");
    await load();
  }

  return <main className="privatePage privateModuleScope ownerTeam" id="main-content">
    <header className="employeeHero"><div><p className="privateEyebrow">ÉQUIPE · BÊTA PRIVÉE</p><h1>{selectedProfile ? selectedProfile.display_name : "Personnel & ménage."}</h1><p>Registre canonique des prestations, heures, linge, paiements et soldes calculés côté serveur.</p></div>{selectedProfile && <button className="privateTextButton" onClick={closeProfile}>← Vue globale</button>}</header>
    {message && <p className="privateInlineMessage">{message}</p>}
    {loading && <div className="privateLoadingCard" role="status">Chargement de l’équipe…</div>}
    {!loading && !selectedProfile && <section className="privateMetricGrid teamSummary" aria-label="Synthèse équipe"><article><strong>{teamTotals.hours.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</strong><span>Total heures</span></article><article><strong>{teamTotals.linen}</strong><span>Total linge</span></article><article><strong>{money(teamTotals.due)}</strong><span>Total dû</span></article><article><strong>{money(teamTotals.paid)}</strong><span>Total payé</span></article><article className="metricAlert"><strong>{money(teamTotals.balance)}</strong><span>Solde global</span></article></section>}

    {!loading && <section className="teamFilters" aria-label="Filtres"><select aria-label="Personne" value={filters.person} onChange={(e) => setFilters({ ...filters, person: e.target.value })}><option value="">Toutes les personnes</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select><select aria-label="Logement" value={filters.property} onChange={(e) => setFilters({ ...filters, property: e.target.value })}><option value="">Tous les logements</option><option value="Fives">Fives</option><option value="Melezio">Melezio</option><option value="Gare">Gare</option><option value="Wattignies">Wattignies</option><option value="NO_PROPERTY_REQUIRED">Sans logement requis</option><option value="PROPERTY_REVIEW_REQUIRED">Logement à vérifier</option></select><select aria-label="Type de prestation" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">Tous les types</option><option value="HOUSEKEEPING">Ménage</option><option value="LAUNDRY">Linge</option><option value="PURCHASE">Achat</option><option value="MISC_SERVICE">Mission</option></select><select aria-label="Statut de paiement" value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}><option value="">Tous les soldes</option><option value="OUTSTANDING">Solde à payer</option><option value="SETTLED">Soldé</option></select><input aria-label="Début" type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })}/><input aria-label="Fin" type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })}/></section>}

    {!loading && !selectedProfile && <section className="teamBalanceDirectory">{directory.map((item) => <button key={item.person_id} onClick={() => openProfile(item.person_id)}><span><strong>{item.display_name}</strong><small>{Number(item.total_hours).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h · {item.linen_pairs} jeux de linge</small><small>{money(item.due_work)} travail · {money(item.due_laundry)} linge · {money(item.due_other)} autres</small></span><span><small>Payé {money(item.wage_payments_included)}</small><strong>{money(item.balance)}</strong></span></button>)}</section>}

    {!loading && selectedBalance && <section aria-labelledby="synthese-title"><h2 id="synthese-title" className="sectionTitle">Synthèse</h2><div className="employeeAccountStatus"><span><b>Compte Personnel</b><small>{selectedProfile?.user_id ? (selectedProfile.active && selectedProfile.status === "ACTIVE" ? "Actif" : "Désactivé") : "Non créé — aucune invitation envoyée"}</small></span><strong>{selectedProfile?.user_id ? "LIÉ" : "À INVITER APRÈS GO"}</strong></div><BalanceCards balance={selectedBalance} /></section>}

    {!loading && selectedProfile && <PersonOperationalDetail entries={visibleEntries} payments={ordinaryPayments} adjustments={adjustments} balance={selectedBalance} />}

    {!loading && !selectedProfile && <section className="ownerTeamGrid"><article><h2>Prestations ({visibleEntries.length})</h2>{visibleEntries.map((item) => <EntryRow item={item} key={item.id} />)}</article><article><h2>Paiements ({ordinaryPayments.length})</h2>{ordinaryPayments.map((item) => <PaymentRow item={item} key={item.id} />)}</article></section>}

    {!loading && !selectedProfile && <section className="propertyReviewQueue"><div><p className="privateEyebrow">OWNER ONLY</p><h2>Logements à vérifier ({reviewEntries.length})</h2><p>« Sans logement requis » reste un état canonique distinct et n’apparaît pas ici.</p></div>{reviewEntries.length === 0 && <div className="privateEmptyCard"><h3>Aucune ligne en attente.</h3><p>Les décisions Gare/Lily et l’examen Tibado House sont entièrement résolus.</p></div>}{reviewEntries.map((item) => <article className="reviewDecisionCard" key={item.id}><div><strong>{profiles.find((profile) => profile.id === item.person_id)?.display_name || item.staff_name}</strong><span>{item.service_date} · {item.service_type} · {formatDuration(item.minutes)}</span><small>Brut : {item.raw_property_primary || "—"} / {item.raw_property_secondary || "—"}</small><p>{item.remarks || item.mission_description || "Aucun indice textuel supplémentaire."}</p><code>{item.source_record_id}</code></div><div className="reviewActions">{["FIVES","MELEZIO","GARE","WATTIGNIES","NO_PROPERTY_REQUIRED"].map((decision) => <button key={decision} onClick={() => decideProperty(item.id, decision)}>{decision === "NO_PROPERTY_REQUIRED" ? "Sans logement requis" : `Assigner ${decision[0]}${decision.slice(1).toLowerCase()}`}</button>)}</div></article>)}</section>}

    {!loading && selectedProfile && <form className="paymentAction" onSubmit={recordPayment}><div><p className="privateEyebrow">ACTION OWNER · TEST UNIQUEMENT</p><h2>Enregistrer un paiement effectué</h2><p>Cette action ajoute une écriture au registre. Elle ne déclenche aucun paiement réel.</p></div><label>Montant (€)<input required step="0.01" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })}/></label><label>Date<input required type="date" value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })}/></label><label>Nature<select value={payment.kind} onChange={(e) => setPayment({ ...payment, kind: e.target.value })}><option value="WAGE_PAYMENT">Paiement salaire</option><option value="EXPENSE_REIMBURSEMENT">Remboursement de frais</option><option value="LEGACY_ADJUSTMENT">Ajustement historique</option><option value="OTHER_REVIEWED">Autre écriture vérifiée</option></select></label><label>Note<input value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })}/></label><label>Référence<input value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })}/></label><button className="privatePrimaryAction" type="submit">Enregistrer</button></form>}
    {!loading && profiles.length === 0 && <div className="privateEmptyCard"><h2>Aucun compte Employé réel créé.</h2><p>Gaëlle, Jennifer et Rachida ne seront invitées qu’après un GO Owner distinct.</p></div>}
  </main>;
}

function propertyFilterKey(item) {
  if (["PROPERTY_REVIEW_REQUIRED", "OWNER_REVIEW_REQUIRED"].includes(item.mapping_status)) return "PROPERTY_REVIEW_REQUIRED";
  if (item.mapping_status === "NO_PROPERTY_REQUIRED") return "NO_PROPERTY_REQUIRED";
  return item.property || "";
}

function propertyLabel(item) {
  if (["PROPERTY_REVIEW_REQUIRED", "OWNER_REVIEW_REQUIRED"].includes(item.mapping_status)) return "Logement à vérifier";
  if (item.mapping_status === "NO_PROPERTY_REQUIRED") return "Sans logement requis";
  return item.property || "Logement à vérifier";
}

function EntryRow({ item }) {
  return <div className="teamRow"><span>{propertyLabel(item)}{["PROPERTY_REVIEW_REQUIRED", "OWNER_REVIEW_REQUIRED"].includes(item.mapping_status) && <em className="reviewPill">À vérifier</em>}<small>{new Date(`${item.service_date}T12:00:00`).toLocaleDateString("fr-FR")} · {item.service_type} · {item.linen_pairs || 0} linge</small></span><strong>{formatDuration(item.minutes)}<small>{money(item.due_total_amount)}</small></strong></div>;
}

function PaymentRow({ item }) {
  return <div className="teamRow"><span>{item.note || item.payment_kind}<small>{new Date(`${item.payment_date}T12:00:00`).toLocaleDateString("fr-FR")} · {item.payment_kind}</small></span><strong>{money(item.amount)}</strong></div>;
}

function PersonOperationalDetail({ entries, payments, adjustments, balance }) {
  const housekeeping = entries.filter((item) => item.service_type === "HOUSEKEEPING");
  const laundry = entries.filter((item) => item.service_type === "LAUNDRY" || Number(item.linen_pairs) > 0);
  const other = entries.filter((item) => !["HOUSEKEEPING", "LAUNDRY"].includes(item.service_type));
  return <section className="personOperationalDetail">
    <article><h2>Prestations</h2>{housekeeping.map((item) => <EntryRow item={item} key={item.id} />)}</article>
    <article><h2>Linge</h2>{laundry.map((item) => <EntryRow item={item} key={item.id} />)}</article>
    <article><h2>Autres</h2>{other.map((item) => <EntryRow item={item} key={item.id} />)}</article>
    <article><h2>Paiements</h2>{payments.map((item) => <PaymentRow item={item} key={item.id} />)}</article>
    <article className="adjustmentPanel"><h2>Ajustements</h2>{adjustments.length === 0 && <p>Aucun ajustement historique.</p>}{adjustments.map((item) => <div className="adjustmentRow" key={item.id}><div><span className="reviewPill">Origine métier non démontrée</span><h3>Ajustement historique</h3><p>Contre-écriture créée le 03/08/2026 afin de neutraliser un écart historique de 91,50 €. Origine métier non démontrée.</p><small>{item.payment_date} · {item.note}</small></div><strong>{money(item.amount)}</strong></div>)}</article>
    {balance && <article><h2>Solde</h2><p>Total dû {money(balance.total_due)} · payé inclus {money(balance.wage_payments_included)}.</p><strong className="detailBalance">{money(balance.balance)} restant</strong></article>}
  </section>;
}

function normalizeEntries(entries) {
  return entries.map((item) => ({ ...item, occurred_at: item.source_submitted_at || `${item.service_date}T12:00:00` }));
}

function BalanceCards({ balance, personal = false }) {
  return <section className="privateMetricGrid balanceMetricGrid" aria-label={personal ? "Mon solde" : "Solde du profil"}><article><strong>{money(balance.total_due)}</strong><span>Total dû</span></article><article><strong>{money(balance.wage_payments_included)}</strong><span>Paiements inclus</span></article><article className="metricAlert"><strong>{money(balance.balance)}</strong><span>Reste à payer</span></article><article><strong>{Number(balance.total_hours).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</strong><span>{balance.linen_pairs} jeux de linge</span></article></section>;
}
