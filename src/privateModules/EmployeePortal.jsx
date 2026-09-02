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
  const [tab, setTab] = useState("OVERVIEW");
  const [period, setPeriod] = useState("CURRENT_MONTH");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [filters, setFilters] = useState({ search: "", property: "", type: "", sort: "NEWEST" });
  const [historyLimit, setHistoryLimit] = useState(12);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payment, setPayment] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), kind: "WAGE_PAYMENT", note: "", reference: "" });
  const [accountForm, setAccountForm] = useState({ open: false, firstName: "", lastName: "", email: "" });
  const [accountState, setAccountState] = useState("");
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

  useEffect(() => {
    let current = true;
    if (!selectedProfileId) return () => { current = false; };
    void supabase.functions.invoke("employee-account-admin", {
      body: { action: "status", personId: selectedProfileId },
    }).then((result) => {
      if (current) setAccountState(result.error || result.data?.error ? "STATUS_UNAVAILABLE" : result.data?.state || "STATUS_UNAVAILABLE");
    });
    return () => { current = false; };
  }, [selectedProfileId]);

  const selectedProfile = profiles.find((item) => item.id === selectedProfileId);
  const selectedBalance = balances.find((item) => item.person_id === selectedProfileId);
  const dateRange = ownerPeriodRange(period, customRange);
  const personEntries = entries.filter((item) => item.person_id === selectedProfileId);
  const personPayments = payments.filter((item) => item.person_id === selectedProfileId);
  const periodEntries = personEntries.filter((item) => dateInRange(item.service_date, dateRange));
  const periodPayments = personPayments.filter((item) => dateInRange(item.payment_date, dateRange));
  const normalizedSearch = filters.search.trim().toLocaleLowerCase("fr");
  const visibleEntries = periodEntries.filter((item) => (!filters.property || propertyFilterKey(item) === filters.property)
    && (!filters.type || item.service_type === filters.type)
    && (!normalizedSearch || [propertyLabel(item), serviceTypeLabel(item.service_type), item.service_date, formatDate(item.service_date), item.mission_description, item.remarks]
      .filter(Boolean).join(" ").toLocaleLowerCase("fr").includes(normalizedSearch)))
    .sort((a, b) => filters.sort === "OLDEST" ? a.service_date.localeCompare(b.service_date) : b.service_date.localeCompare(a.service_date));
  const visiblePayments = periodPayments.filter((item) => !normalizedSearch || [paymentTypeLabel(item.payment_kind), item.note, item.external_reference, item.payment_date, formatDate(item.payment_date)]
    .filter(Boolean).join(" ").toLocaleLowerCase("fr").includes(normalizedSearch));
  const reviewEntries = entries.filter((item) => ["PROPERTY_REVIEW_REQUIRED", "OWNER_REVIEW_REQUIRED"].includes(item.mapping_status));
  const teamTotals = balances.reduce((total, item) => ({
    hours: total.hours + Number(item.total_hours || 0),
    linen: total.linen + Number(item.linen_pairs || 0),
    due: total.due + Number(item.total_due || 0),
    paid: total.paid + Number(item.wage_payments_included || 0),
    balance: total.balance + Number(item.balance || 0),
  }), { hours: 0, linen: 0, due: 0, paid: 0, balance: 0 });
  const periodSummary = periodEntries.reduce((total, item) => ({
    minutes: total.minutes + Number(item.minutes || 0),
    linen: total.linen + Number(item.linen_pairs || 0),
    due: total.due + Number(item.due_total_amount || 0),
    other: total.other + Number(item.due_other || item.due_other_amount || item.due_purchase_amount || 0),
  }), { minutes: 0, linen: 0, due: 0, other: 0 });
  const paidInPeriod = periodPayments.filter((item) => item.payment_kind !== "EXPENSE_REIMBURSEMENT")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const groupedProperties = periodEntries.reduce((result, item) => {
    const key = propertyLabel(item);
    (result[key] ||= []).push(item);
    return result;
  }, {});
  const latestPayment = [...personPayments].sort((a, b) => b.payment_date.localeCompare(a.payment_date))[0];

  function openProfile(id) {
    setAccountState("");
    setTab("OVERVIEW");
    setPeriod("CURRENT_MONTH");
    setFilters({ search: "", property: "", type: "", sort: "NEWEST" });
    setHistoryLimit(12);
    setSelectedProfileId(id);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#team/${id}`);
  }

  function closeProfile() {
    setAccountState("");
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
    setPaymentModalOpen(false);
    await load();
  }

  async function manageEmployeeAccount(action) {
    if (action === "disable" && !window.confirm("Désactiver immédiatement l’accès Personnel de cette salariée ?")) return;
    if (action === "recovery" && !window.confirm("Envoyer un email de récupération à cette salariée ?")) return;
    setMessage("");
    const result = await supabase.functions.invoke("employee-account-admin", {
      body: {
        action,
        personId: selectedProfileId,
        firstName: accountForm.firstName,
        lastName: accountForm.lastName,
        email: accountForm.email,
      },
    });
    if (result.error || result.data?.error) {
      setMessage("Action compte refusée ou impossible. Aucune donnée Personnel n’a été modifiée.");
      return;
    }
    setMessage(action === "invite" ? "Invitation envoyée. La salariée choisira elle-même son mot de passe." : action === "disable" ? "Accès désactivé." : "Lien de récupération envoyé.");
    setAccountForm({ open: false, firstName: "", lastName: "", email: "" });
    await load();
  }

  const accountLabel = {
    ACCOUNT_NOT_CREATED: "Compte non créé",
    INVITED: "Invitation envoyée",
    ACTIVE: "Compte actif",
    DISABLED: "Compte désactivé",
    STATUS_UNAVAILABLE: "État indisponible",
  }[accountState] || "Vérification…";

  if (!selectedProfile) return <main className="privatePage privateModuleScope ownerTeam ownerTeamV2" id="main-content">
    <header className="ownerDirectoryHeader"><div><p className="privateEyebrow">PERSONNEL · BÊTA PRIVÉE</p><h1>Équipe</h1><p>Heures, paiements et soldes — une vue claire, sans perdre le détail.</p></div><div className="ownerDirectoryTotal"><span>Solde à régler</span><strong>{money(teamTotals.balance)}</strong></div></header>
    {message && <p className="privateInlineMessage">{message}</p>}
    {loading && <div className="privateLoadingCard" role="status">Chargement de l’équipe…</div>}
    {!loading && <><section className="ownerTeamStrip" aria-label="Synthèse équipe"><span><b>{teamTotals.hours.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</b> heures</span><span><b>{money(teamTotals.due)}</b> dû</span><span><b>{money(teamTotals.paid)}</b> payé</span><span><b>{teamTotals.linen}</b> linge</span></section><section className="ownerPeopleGrid">{balances.map((item) => <button key={item.person_id} onClick={() => openProfile(item.person_id)}><span className="ownerAvatar" aria-hidden="true">{item.display_name.slice(0, 1)}</span><span><strong>{item.display_name}</strong><small>{Number(item.total_hours).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h · {item.linen_pairs} linge</small></span><span className="ownerPersonBalance"><small>À régler</small><strong>{money(item.balance)}</strong></span></button>)}</section><section className="ownerReviewSummary"><span><b>Logements à vérifier</b><small>{reviewEntries.length ? "Une décision Owner est attendue." : "Tout est classé."}</small></span><strong>{reviewEntries.length}</strong></section></>}
  </main>;

  return <main className="privatePage privateModuleScope ownerTeam ownerTeamV2" id="main-content">
    <header className="ownerPersonHeader"><button className="ownerBackButton" onClick={closeProfile}>← Équipe</button><div className="ownerIdentity"><span className="ownerAvatar" aria-hidden="true">{selectedProfile.display_name.slice(0, 1)}</span><div><p className="privateEyebrow">PERSONNEL</p><h1>{selectedProfile.display_name}</h1><p><span className={`accountStatusDot ${accountState.toLowerCase()}`}></span>{accountLabel}</p></div></div><div className="ownerCurrentBalance"><span>Solde actuel</span><strong>{money(selectedBalance?.balance)}</strong><small>sur tout l’historique</small></div><button className="privateTextButton" onClick={() => setTab("ACCOUNT")}>Gérer le compte</button></header>
    {message && <p className="privateInlineMessage" role="status">{message}</p>}
    <section className="ownerPeriodBar" aria-label="Période"><span>Activité</span>{[["CURRENT_MONTH","Ce mois"],["PREVIOUS_MONTH","Mois dernier"],["THREE_MONTHS","3 mois"],["YEAR","Année"],["ALL","Tout"]].map(([value,label]) => <button key={value} className={period === value ? "active" : ""} aria-pressed={period === value} onClick={() => { setPeriod(value); setHistoryLimit(12); }}>{label}</button>)}<button className={period === "CUSTOM" ? "active" : ""} aria-pressed={period === "CUSTOM"} onClick={() => setPeriod("CUSTOM")}>Dates</button>{period === "CUSTOM" && <span className="ownerCustomDates"><input aria-label="Date de début" type="date" value={customRange.start} onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}/><input aria-label="Date de fin" type="date" value={customRange.end} onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}/></span>}</section>
    <section className="ownerKpiStrip" aria-label="Indicateurs de période"><article><span>Heures</span><strong>{formatDuration(periodSummary.minutes)}</strong></article><article><span>Dû sur période</span><strong>{money(periodSummary.due)}</strong></article><article><span>Payé sur période</span><strong>{money(paidInPeriod)}</strong></article><article className="ownerBalanceKpi"><span>Solde actuel</span><strong>{money(selectedBalance?.balance)}</strong><small>historique</small></article><article className="ownerMinorKpi"><span>Linge</span><strong>{periodSummary.linen}</strong></article><article className="ownerMinorKpi"><span>Autres</span><strong>{money(periodSummary.other)}</strong></article></section>
    <nav className="ownerTabs" role="tablist" aria-label="Dossier de la salariée">{[["OVERVIEW","Vue d’ensemble"],["ENTRIES","Prestations"],["PROPERTIES","Logements"],["PAYMENTS","Paiements"],["ACCOUNT","Compte"]].map(([value,label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => { setTab(value); setHistoryLimit(12); }}>{label}</button>)}</nav>

    {tab === "OVERVIEW" && <section className="ownerOverview" role="tabpanel"><article className="ownerPanel ownerActivityPanel"><div className="ownerPanelHeading"><div><p className="privateEyebrow">DERNIÈRE ACTIVITÉ</p><h2>{visibleEntries.length} prestation{visibleEntries.length > 1 ? "s" : ""} sur la période</h2></div><button className="privateTextButton" onClick={() => setTab("ENTRIES")}>Tout voir</button></div><div className="ownerCompactList">{visibleEntries.slice(0, 6).map((item) => <EntryRow item={item} key={item.id}/>)}</div>{visibleEntries.length === 0 && <EmptyPeriod />}</article><article className="ownerPanel ownerPropertyChart"><div className="ownerPanelHeading"><div><p className="privateEyebrow">HEURES PAR LOGEMENT</p><h2>Répartition</h2></div></div>{Object.entries(groupedProperties).sort((a,b) => b[1].reduce((s,i)=>s+Number(i.minutes||0),0)-a[1].reduce((s,i)=>s+Number(i.minutes||0),0)).map(([name,items]) => { const minutes=items.reduce((sum,item)=>sum+Number(item.minutes||0),0); return <button key={name} onClick={() => { setFilters({ ...filters, property: propertyFilterKey(items[0]) }); setTab("ENTRIES"); }}><span>{name}<small>{formatDuration(minutes)}</small></span><i><b style={{ width: `${periodSummary.minutes ? Math.max(5,(minutes / periodSummary.minutes) * 100) : 0}%` }}></b></i></button>; })}</article><article className="ownerPanel ownerPaymentSnapshot"><p className="privateEyebrow">PAIEMENTS</p><h2>{latestPayment ? money(latestPayment.amount) : "Aucun"}</h2><p>{latestPayment ? `Dernier paiement · ${formatDate(latestPayment.payment_date)}` : "Aucun paiement enregistré"}</p><button className="privateTextButton" onClick={() => setTab("PAYMENTS")}>Voir les paiements</button></article></section>}

    {tab === "ENTRIES" && <section role="tabpanel"><OwnerDataToolbar filters={filters} setFilters={setFilters} entries={periodEntries}/><div className="ownerEntriesTable">{visibleEntries.slice(0, historyLimit).map((item) => <EntryRow item={item} key={item.id}/>)}</div>{visibleEntries.length === 0 && <EmptyPeriod />}{visibleEntries.length > historyLimit && <button className="ownerLoadMore" onClick={() => setHistoryLimit((value) => value + 12)}>Afficher 12 de plus <small>{visibleEntries.length - historyLimit} restantes</small></button>}</section>}

    {tab === "PROPERTIES" && <section className="ownerPropertyGrid" role="tabpanel">{Object.entries(groupedProperties).map(([name,items]) => <button key={name} className={name === "Sans logement requis" ? "noPropertyGroup" : ""} onClick={() => { setFilters({ ...filters, property: propertyFilterKey(items[0]) }); setTab("ENTRIES"); }}><span className="ownerPropertyIcon" aria-hidden="true">{name === "Sans logement requis" ? "◇" : "⌂"}</span><div><p className="privateEyebrow">{name === "Sans logement requis" ? "CONTEXTE" : "LOGEMENT"}</p><h2>{name}</h2><span>{items.length} intervention{items.length > 1 ? "s" : ""}</span></div><dl><div><dt>Heures</dt><dd>{formatDuration(items.reduce((sum,item)=>sum+Number(item.minutes||0),0))}</dd></div><div><dt>Montant</dt><dd>{money(items.reduce((sum,item)=>sum+Number(item.due_total_amount||0),0))}</dd></div><div><dt>Linge</dt><dd>{items.reduce((sum,item)=>sum+Number(item.linen_pairs||0),0)}</dd></div></dl><span className="ownerCardArrow">→</span></button>)}{Object.keys(groupedProperties).length === 0 && <EmptyPeriod />}</section>}

    {tab === "PAYMENTS" && <section role="tabpanel"><div className="ownerPaymentsHeader"><div><p className="privateEyebrow">HISTORIQUE FINANCIER</p><h2>Paiements</h2><p>Le solde reste calculé par le registre canonique.</p></div><button className="privatePrimaryAction" onClick={() => setPaymentModalOpen(true)}>+ Enregistrer un paiement</button></div><section className="ownerPaymentTotals"><span><small>Total dû</small><b>{money(selectedBalance?.total_due)}</b></span><span><small>Total payé</small><b>{money(selectedBalance?.wage_payments_included)}</b></span><span><small>Solde actuel</small><b>{money(selectedBalance?.balance)}</b></span></section><label className="ownerPaymentSearch">Rechercher dans les paiements<input type="search" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Note, référence, date…"/></label><div className="ownerPaymentList">{visiblePayments.map((item) => <PaymentRow item={item} key={item.id}/>)}</div>{visiblePayments.length === 0 && <EmptyPeriod />}</section>}

    {tab === "ACCOUNT" && <section className="ownerAccountPanel" role="tabpanel"><div><p className="privateEyebrow">ACCÈS PERSONNEL</p><h2>{accountLabel}</h2><p>La salariée choisit toujours elle-même son mot de passe.</p></div><div className="accountActions">{accountState === "ACCOUNT_NOT_CREATED" ? <button className="privatePrimaryAction" onClick={() => setAccountForm((current) => ({ ...current, open: !current.open }))}>Préparer l’invitation</button> : ["ACTIVE", "INVITED"].includes(accountState) ? <><button className="privateTextButton" onClick={() => manageEmployeeAccount("recovery")}>Envoyer un lien de récupération</button><button className="privateTextButton dangerAccountAction" onClick={() => manageEmployeeAccount("disable")}>Désactiver l’accès</button></> : null}</div>{accountForm.open && accountState === "ACCOUNT_NOT_CREATED" && <form className="employeeInviteForm" onSubmit={(event) => { event.preventDefault(); void manageEmployeeAccount("invite"); }}><p>Aucun mot de passe n’est demandé. L’envoi créera le compte réel : ne validez qu’après autorisation.</p><label>Prénom<input required value={accountForm.firstName} onChange={(event) => setAccountForm({ ...accountForm, firstName: event.target.value })}/></label><label>Nom<input required value={accountForm.lastName} onChange={(event) => setAccountForm({ ...accountForm, lastName: event.target.value })}/></label><label>Email<input required type="email" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })}/></label><button className="privatePrimaryAction" type="submit">Envoyer l’invitation</button></form>}</section>}

    {paymentModalOpen && <div className="ownerModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaymentModalOpen(false); }}><section className="ownerPaymentModal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title"><header><div><p className="privateEyebrow">ACTION OWNER</p><h2 id="payment-modal-title">Enregistrer un paiement</h2><p>Enregistre un paiement déjà effectué. Aucun virement bancaire n’est initié.</p></div><button aria-label="Fermer" onClick={() => setPaymentModalOpen(false)}>×</button></header><form onSubmit={recordPayment}><label>Montant (€)<input autoFocus required step="0.01" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })}/></label><label>Date<input required type="date" value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })}/></label><label>Nature<select value={payment.kind} onChange={(e) => setPayment({ ...payment, kind: e.target.value })}><option value="WAGE_PAYMENT">Paiement</option><option value="EXPENSE_REIMBURSEMENT">Remboursement de frais</option><option value="LEGACY_ADJUSTMENT">Ajustement historique</option><option value="OTHER_REVIEWED">Autre écriture vérifiée</option></select></label><label>Note<input value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })}/></label><label>Référence<input value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })}/></label><footer><button type="button" className="privateTextButton" onClick={() => setPaymentModalOpen(false)}>Annuler</button><button className="privatePrimaryAction" type="submit">Enregistrer</button></footer></form></section></div>}
  </main>;
}

function OwnerDataToolbar({ filters, setFilters, entries }) {
  const properties = [...new Map(entries.map((item) => [propertyFilterKey(item), propertyLabel(item)])).entries()];
  return <section className="ownerDataToolbar" aria-label="Recherche et filtres"><label className="ownerSearchField"><span>Rechercher</span><input type="search" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Logement, date, type…"/></label><label><span>Logement</span><select value={filters.property} onChange={(e) => setFilters({ ...filters, property: e.target.value })}><option value="">Tous</option>{properties.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Type</span><select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">Tous</option><option value="HOUSEKEEPING">Ménage</option><option value="LAUNDRY">Linge</option><option value="MISC_SERVICE">Autre prestation</option><option value="PURCHASE">Achat</option></select></label><label><span>Tri</span><select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="NEWEST">Plus récent</option><option value="OLDEST">Plus ancien</option></select></label></section>;
}

function ownerPeriodRange(period, customRange) {
  const now = new Date();
  if (period === "ALL") return { start: null, end: null };
  if (period === "CUSTOM") return { start: customRange.start || null, end: customRange.end || null };
  if (period === "YEAR") return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
  const offset = period === "PREVIOUS_MONTH" ? -1 : period === "THREE_MONTHS" ? -2 : 0;
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = period === "PREVIOUS_MONTH" ? new Date(now.getFullYear(), now.getMonth(), 0) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: localDateValue(start), end: localDateValue(end) };
}

function dateInRange(value, range) {
  return (!range.start || value >= range.start) && (!range.end || value <= range.end);
}

function localDateValue(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  return <div className="teamRow ownerEntryRow"><time dateTime={item.service_date}>{formatDate(item.service_date)}</time><span><strong>{propertyLabel(item)}</strong>{["PROPERTY_REVIEW_REQUIRED", "OWNER_REVIEW_REQUIRED"].includes(item.mapping_status) && <em className="reviewPill">À vérifier</em>}<small>{serviceTypeLabel(item.service_type)}{Number(item.linen_pairs || 0) ? ` · ${item.linen_pairs} linge` : ""}</small></span><strong className="ownerEntryDuration">{formatDuration(item.minutes)}</strong><strong>{money(item.due_total_amount)}</strong></div>;
}

function PaymentRow({ item }) {
  const reimbursement = item.payment_kind === "EXPENSE_REIMBURSEMENT";
  return <div className={`teamRow ownerPaymentRow ${reimbursement ? "reimbursement" : ""}`}><time dateTime={item.payment_date}>{formatDate(item.payment_date)}</time><span><strong>{paymentTypeLabel(item.payment_kind)}</strong><small>{item.note || "Sans note"}{item.external_reference ? ` · Réf. ${item.external_reference}` : ""}</small>{reimbursement && <em>Hors solde salaire</em>}</span><strong>{money(item.amount)}</strong></div>;
}

function serviceTypeLabel(value) {
  return { HOUSEKEEPING: "Ménage", LAUNDRY: "Linge", MISC_SERVICE: "Autre prestation", PURCHASE: "Achat" }[value] || "Prestation";
}

function normalizeEntries(entries) {
  return entries.map((item) => ({ ...item, occurred_at: item.source_submitted_at || `${item.service_date}T12:00:00` }));
}

function paymentTypeLabel(value) {
  return { WAGE_PAYMENT: "Paiement", EXPENSE_REIMBURSEMENT: "Remboursement de frais", LEGACY_ADJUSTMENT: "Ajustement historique", OTHER_REVIEWED: "Autre écriture vérifiée" }[value] || "Paiement";
}
