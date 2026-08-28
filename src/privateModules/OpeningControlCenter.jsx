import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  CATEGORIES,
  EFFORTS,
  OPENING_AT,
  OPENING_PLAN,
  PRIORITIES,
  daysUntilOpening,
  isOverdue,
  progressFor,
  tomorrowIso,
} from "./openingPlan";

const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
const PRIORITY_LABELS = {
  P0_CRITICAL: "P0 · Critique",
  P1_IMPORTANT: "P1 · Important",
  P2_CAN_WAIT: "P2 · Peut attendre",
};
const EFFORT_LABELS = { LIGHT: "Léger", NORMAL: "Normal", HEAVY: "Intense" };

function mondayAndSunday(todayIso) {
  const date = new Date(`${todayIso}T12:00:00`);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
}

function emptyDraft() {
  return {
    title: "",
    description: "",
    due_date: TODAY,
    week_label: "AJOUT OWNER",
    category: "OUVERTURE",
    priority: "P1_IMPORTANT",
    status: "TODO",
    effort: "NORMAL",
    notes: "",
    sort_order: 900,
  };
}

export default function OpeningControlCenter({ session }) {
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("TODAY");
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  async function loadTasks() {
    setBusy(true);
    const query = await supabase
      .from("tibaldo_app_opening_tasks")
      .select("*")
      .eq("owner_user_id", session.user.id)
      .order("due_date")
      .order("sort_order");

    if (query.error) {
      setMessage(`Lecture impossible : ${query.error.message}`);
      setBusy(false);
      return;
    }

    if (query.data.length === 0) {
      const seedRows = OPENING_PLAN.map((item, index) => ({
        ...item,
        owner_user_id: session.user.id,
        sort_order: index,
      }));
      const seeded = await supabase.from("tibaldo_app_opening_tasks").upsert(seedRows, {
        onConflict: "owner_user_id,seed_key",
        ignoreDuplicates: true,
      });
      if (seeded.error) {
        setMessage(`Initialisation impossible : ${seeded.error.message}`);
        setBusy(false);
        return;
      }
      return loadTasks();
    }

    setTasks(query.data);
    setBusy(false);
  }

  useEffect(() => {
    loadTasks();
    // Session user changes remount the protected workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function saveDraft(event) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setMessage("");
    const payload = {
      ...draft,
      title: draft.title.trim(),
      owner_user_id: session.user.id,
      completed_at: draft.status === "DONE" ? new Date().toISOString() : null,
    };
    const result = editing
      ? await supabase.from("tibaldo_app_opening_tasks").update(payload).eq("id", editing).eq("owner_user_id", session.user.id)
      : await supabase.from("tibaldo_app_opening_tasks").insert(payload);
    if (result.error) return setMessage(`Enregistrement impossible : ${result.error.message}`);
    setDraft(emptyDraft());
    setEditing(null);
    setShowForm(false);
    setMessage(editing ? "Tâche mise à jour." : "Tâche ajoutée.");
    await loadTasks();
  }

  async function patchTask(task, changes) {
    const payload = { ...changes };
    if (changes.status === "DONE") payload.completed_at = new Date().toISOString();
    if (changes.status && changes.status !== "DONE") payload.completed_at = null;
    const result = await supabase
      .from("tibaldo_app_opening_tasks")
      .update(payload)
      .eq("id", task.id)
      .eq("owner_user_id", session.user.id);
    if (result.error) return setMessage(`Modification impossible : ${result.error.message}`);
    await loadTasks();
  }

  async function deleteTask(task) {
    if (!window.confirm(`Supprimer « ${task.title} » ?`)) return;
    const result = await supabase
      .from("tibaldo_app_opening_tasks")
      .delete()
      .eq("id", task.id)
      .eq("owner_user_id", session.user.id);
    if (result.error) return setMessage(`Suppression impossible : ${result.error.message}`);
    setMessage("Tâche supprimée.");
    await loadTasks();
  }

  function startEdit(task) {
    setShowForm(true);
    setEditing(task.id);
    setDraft({
      title: task.title,
      description: task.description || "",
      due_date: task.due_date,
      week_label: task.week_label,
      category: task.category,
      priority: task.priority,
      status: task.status,
      effort: task.effort,
      notes: task.notes || "",
      sort_order: task.sort_order,
      seed_key: task.seed_key,
    });
    window.requestAnimationFrame(() => {
      document.getElementById("opening-quick-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const [weekStart, weekEnd] = mondayAndSunday(TODAY);
  const shown = useMemo(() => tasks.filter((item) => {
    if (view === "TODAY") return item.due_date <= TODAY && item.status !== "DONE";
    if (view === "WEEK") return item.due_date >= weekStart && item.due_date <= weekEnd;
    return true;
  }), [tasks, view, weekStart, weekEnd]);

  const metrics = useMemo(() => ({
    progress: progressFor(tasks),
    p0: tasks.filter((item) => item.priority === "P0_CRITICAL" && item.status !== "DONE").length,
    today: tasks.filter((item) => item.due_date === TODAY && item.status !== "DONE").length,
    overdue: tasks.filter((item) => isOverdue(item, TODAY)).length,
  }), [tasks]);

  return (
    <main className="privatePage privateModuleScope openingCenter" id="main-content">
      <header className="openingHero">
        <div>
          <p className="privateEyebrow">OUVERTURE BOUTIQUE</p>
          <h1>Cap sur le 26 septembre.</h1>
          <p>Un tableau simple pour décider quoi faire aujourd’hui, sans saturer la semaine.</p>
        </div>
        <div className="countdown" aria-label={`${daysUntilOpening()} jours avant l'ouverture`}>
          <strong>J-{daysUntilOpening()}</strong>
          <span>26 septembre · 18:00</span>
        </div>
      </header>

      <section className="privateMetricGrid" aria-label="Progression ouverture">
        <article><strong>{metrics.progress}%</strong><span>progression globale</span></article>
        <article><strong>{metrics.p0}</strong><span>P0 restants</span></article>
        <article><strong>{metrics.today}</strong><span>à faire aujourd’hui</span></article>
        <article className={metrics.overdue ? "metricAlert" : ""}><strong>{metrics.overdue}</strong><span>en retard</span></article>
      </section>

      <div className="progressTrack" aria-label={`Progression ${metrics.progress}%`}><span style={{ width: `${metrics.progress}%` }} /></div>

      <nav className="privateSegmented" aria-label="Période">
        <button className={view === "TODAY" ? "active" : ""} onClick={() => setView("TODAY")}>Aujourd’hui</button>
        <button className={view === "WEEK" ? "active" : ""} onClick={() => setView("WEEK")}>Cette semaine</button>
        <button className={view === "ALL" ? "active" : ""} onClick={() => setView("ALL")}>Jusqu’à l’ouverture</button>
      </nav>

      {!showForm && <button className="openingAddButton" type="button" onClick={() => setShowForm(true)}>+ Ajouter une tâche</button>}

      {showForm && <form className="quickTaskForm" id="opening-quick-form" onSubmit={saveDraft}>
        <div className="privateFormHeading">
          <div><p className="privateEyebrow">{editing ? "MODIFIER" : "AJOUT RAPIDE"}</p><h2>{editing ? "Ajuster la tâche" : "Ajouter une tâche"}</h2></div>
          <button type="button" className="privateTextButton" onClick={() => { setEditing(null); setDraft(emptyDraft()); setShowForm(false); }}>Fermer</button>
        </div>
        <label className="privateWideField">Titre<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ce qu’il reste à faire" required /></label>
        <label>Date<input type="date" value={draft.due_date} onChange={(event) => setDraft({ ...draft, due_date: event.target.value })} /></label>
        <label>Catégorie<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Priorité<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>{PRIORITIES.map((value) => <option key={value} value={value}>{PRIORITY_LABELS[value]}</option>)}</select></label>
        <label>Effort<select value={draft.effort} onChange={(event) => setDraft({ ...draft, effort: event.target.value })}>{EFFORTS.map((value) => <option key={value} value={value}>{EFFORT_LABELS[value]}</option>)}</select></label>
        <label className="privateWideField">Note courte<textarea rows="2" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
        <button className="privatePrimaryAction" type="submit">{editing ? "Enregistrer" : "Ajouter"}</button>
      </form>}

      {message && <p className="privateInlineMessage" role="status">{message}</p>}
      {busy ? <div className="privateLoadingCard">Chargement du plan…</div> : (
        <section className="openingTaskList" aria-live="polite">
          {shown.length === 0 && <div className="privateEmptyCard"><h2>Rien d’urgent ici.</h2><p>Cette vue est à jour.</p></div>}
          {shown.map((item) => (
            <article className={`openingTask priority-${item.priority}`} key={item.id}>
              <button
                className={`taskCheck ${item.status === "DONE" ? "checked" : ""}`}
                aria-label={item.status === "DONE" ? `Rouvrir ${item.title}` : `Terminer ${item.title}`}
                onClick={() => patchTask(item, { status: item.status === "DONE" ? "TODO" : "DONE" })}
              >{item.status === "DONE" ? "✓" : ""}</button>
              <div className="taskBody">
                <div className="taskMeta"><span>{item.due_date === TODAY ? "Aujourd’hui" : new Date(`${item.due_date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span><span>{item.category}</span><span>{EFFORT_LABELS[item.effort]}</span></div>
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
                {item.notes && <p className="taskNote">{item.notes}</p>}
                <div className="taskActions">
                  <button onClick={() => startEdit(item)}>Modifier</button>
                  <button onClick={() => patchTask(item, { due_date: tomorrowIso(TODAY), status: "DEFERRED" })}>Reporter à demain</button>
                  <button onClick={() => patchTask(item, { status: item.status === "IN_PROGRESS" ? "TODO" : "IN_PROGRESS" })}>{item.status === "IN_PROGRESS" ? "Remettre à faire" : "Commencer"}</button>
                  <button className="dangerTaskAction" onClick={() => deleteTask(item)}>Supprimer</button>
                </div>
              </div>
              <span className="priorityPill">{PRIORITY_LABELS[item.priority].split(" · ")[0]}</span>
            </article>
          ))}
        </section>
      )}
      <time className="openingTime" dateTime={OPENING_AT}>Ouverture : samedi 26 septembre 2026 à 18:00</time>
    </main>
  );
}
