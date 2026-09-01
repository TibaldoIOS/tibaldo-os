import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import PlanPageModule from "./pages/PlanPage";
import IdeasPageModule from "./pages/IdeasPage";
import SearchPageModule from "./pages/SearchPage";
import HomePageModule from "./pages/HomePage";
import UniversePage from "./pages/UniversePage";
import UniverseReactFlow from "./pages/UniverseReactFlow";
import BrainDashboardPage from "./pages/BrainDashboardPage";
import FinancesPage from "./pages/FinancesPage";
import BankImportPage from "./pages/BankImportPage";
import AirbnbFiscalityPage from "./pages/AirbnbFiscalityPage";
import BalancesPage from "./BalancesPage";
import RevenuePage from "./RevenuePage";
import PaymentsPage from "./PaymentsPage";
import OpeningControlCenter from "./privateModules/OpeningControlCenter";
import { EmployeePortal, OwnerTeamOverview } from "./privateModules/EmployeePortal";
import { workspaceForRole } from "./privateModules/employeeProjection";
import "./privateModules/privateModules.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTWc95CaKrduwyhwg3t4LlfjLDI85oPVOA0v1_Dab6C5b1DX_WmgU5vWAGpsJ4oVcED011gqTsxLIWh/pub?output=csv";

const AIRBNB_STORAGE_KEY = "tibaldo_airbnb_reports_v1";

const animals = [
  { key: "uzy", name: "Uzy", emoji: "🐆", type: "Femelle Bengal", status: "Surveillance gestation / mise bas" },
  { key: "zephyr", name: "Zéphyr", emoji: "🐅", type: "Mâle Bengal", status: "Reproducteur / implant / marquage" },
  { key: "bali", name: "Bali", emoji: "🐈", type: "Femelle Bengal", status: "Jeune femelle / croissance" },
];

const tabs = [
  { id: "home", label: "Accueil", icon: "🏡" },
  { id: "opening", label: "Ouverture", icon: "🌿" },
  { id: "team", label: "Équipe", icon: "👥" },
  { id: "search", label: "Recherche", icon: "🔎" },
  { id: "plan", label: "Plan", icon: "🧭" },
  { id: "ideas", label: "Idées", icon: "🧠" },
  { id: "airbnb", label: "Airbnb", icon: "💶" },
  { id: "menage", label: "Ménage", icon: "🧹" },
  { id: "payments", label: "Virements", icon: "💳" },
  { id: "balances", label: "Balances", icon: "📊" },
  { id: "revenues", label: "Revenus", icon: "📈" },
  { id: "plus", label: "Plus", icon: "☰" },
  { id: "universe", label: "Univers", icon: "🌌" },
  { id: "brain", label: "Brain", icon: "🧠" },
  { id: "finances", label: "Finances", icon: "💰" },
  { id: "bankimport", label: "Import Banque", icon: "📄" },
  { id: "fiscalite", label: "Fiscalité", icon: "🏠" },
];

function initialTabFromLocation() {
  const route = window.location.hash.replace(/^#\/?/, "");
  if (route === "me") return "team";
  if (route.startsWith("team/")) return "team";
  return tabs.some((tab) => tab.id === route) ? route : "home";
}

const seedTasks = [
  { title: "Vétérinaire Uzy : vermifuge / antiparasitaire / traitement mère + chatons", category: "Chatterie", priority: "haute", date: "2026-06-08", source: "seed" },
  { title: "Surveiller Uzy : signes de mise bas, comportement, appétit, pertes", category: "Chatterie", priority: "haute", date: "2026-06-08", source: "seed" },
  { title: "Préparer Airbnb du haut : lit, escaliers, plantes fanées, ménage", category: "Airbnb", priority: "haute", date: "2026-06-08", source: "seed" },
  { title: "Point avec la voisine pour les chats pendant l’absence", category: "Animaux", priority: "haute", date: "2026-06-09", time: "10:00", source: "seed" },
  { title: "Arrivée Airbnb du haut", category: "Airbnb", priority: "haute", date: "2026-06-09", time: "17:00", source: "seed" },
  { title: "RDV Novvasy / Ritaline", category: "Santé", priority: "haute", date: "2026-06-12", time: "10:00", source: "seed" },
  { title: "Nadine dépose son chien pour 24h", category: "Animaux", priority: "haute", date: "2026-06-12", time: "14:00", source: "seed" },
  { title: "Soirée collègues au restaurant", category: "Perso", priority: "moyenne", date: "2026-06-12", time: "19:00", source: "seed" },
  { title: "Braderie à Lambersart le matin", category: "Business", priority: "haute", date: "2026-06-14", source: "seed" },
  { title: "Implant Suprelorin / Suolin pour Zéphyr", category: "Chatterie", priority: "haute", date: "2026-06-16", time: "14:00", source: "seed" },
  { title: "RDV addictologue", category: "Santé", priority: "haute", date: "2026-06-19", time: "11:00", source: "seed" },
  { title: "Réserver TER pour Lyon / cousine / Annecy", category: "Vacances", priority: "haute", date: "2026-06-20", source: "seed" },
  { title: "Départ TGV pour Lyon — vacances jusqu’au 29", category: "Vacances", priority: "haute", date: "2026-06-24", source: "seed" },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [membership, setMembership] = useState(null);
  const [accessReady, setAccessReady] = useState(false);
  const [authEmail, setAuthEmail] = useState("contact@tibaldo.fr");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [activeTab, setActiveTab] = useState(initialTabFromLocation);
  const [selectedAnimalKey, setSelectedAnimalKey] = useState("uzy");
  const [weights, setWeights] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function hydrateSession(nextSession) {
    setSession(nextSession);
    setMembership(null);
    if (!nextSession) {
      setAccessReady(true);
      return;
    }

    setAccessReady(false);
    const result = await supabase
      .from("tibaldo_app_memberships")
      .select("user_id, role")
      .eq("user_id", nextSession.user.id)
      .maybeSingle();

    if (!result.error && result.data) {
      setMembership(result.data);
      if (result.data.role === "OWNER") await loadAll();
    }
    setAccessReady(true);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => hydrateSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Defer Supabase calls until the auth callback releases its internal lock.
      window.setTimeout(() => {
        void hydrateSession(nextSession);
      }, 0);
    });

    return () => listener.subscription.unsubscribe();
    // The auth listener owns hydration for the lifetime of the application.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHashChange = () => setActiveTab(initialTabFromLocation());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function navigateToTab(tabId) {
    setActiveTab(tabId);
    if (tabId === "opening" || tabId === "team") window.location.hash = tabId;
    else if (window.location.hash === "#opening" || window.location.hash.startsWith("#team")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  async function signIn() {
    setAuthMessage("Connexion...");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) return setAuthMessage("Erreur connexion : " + error.message);
    setAuthMessage("Connecté ✅");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setMembership(null);
    setWeights([]);
    setTasks([]);
    setIdeas([]);
    setAuthPassword("");
  }

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadWeights(), loadTasks(), loadIdeas()]);
    setLoading(false);
  }

  async function loadWeights() {
    const { data, error } = await supabase
      .from("weights")
      .select("*")
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return setMessage("Erreur lecture pesées : " + error.message);
    setWeights(data || []);
  }

  async function loadTasks() {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return setMessage("Erreur lecture tâches : " + error.message);

    if ((data || []).length === 0) {
      await supabase.from("tasks").insert(seedTasks);
      const retry = await supabase
        .from("tasks")
        .select("*")
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });

      if (!retry.error) setTasks(retry.data || []);
      return;
    }

    setTasks(data || []);
  }

  async function loadIdeas() {
    const { data, error } = await supabase
      .from("ideas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return setMessage("Erreur lecture idées : " + error.message);
    setIdeas(data || []);
  }

  async function addWeight({ animalKey, animalName, date, weight, note }) {
    setMessage("Enregistrement de la pesée...");
    const { error } = await supabase.from("weights").insert({
      animal_key: animalKey,
      animal_name: animalName,
      date,
      weight: Number(weight),
      note,
    });

    if (error) return setMessage("Erreur pesée : " + error.message);
    setMessage("Pesée enregistrée en ligne ✅");
    await loadWeights();
  }

  async function toggleTask(task) {
    const { error } = await supabase
      .from("tasks")
      .update({ done: !task.done })
      .eq("id", task.id);

    if (error) return setMessage("Erreur tâche : " + error.message);
    await loadTasks();
  }

  async function addTask(newTask) {
    const { error } = await supabase.from("tasks").insert(newTask);
    if (error) return setMessage("Erreur ajout tâche : " + error.message);
    setMessage("Tâche ajoutée ✅");
    await loadTasks();
  }

  async function deleteTask(taskId) {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) return setMessage("Erreur suppression tâche : " + error.message);
    await loadTasks();
  }

  async function addIdeasFromText(text) {
    const parsedIdeas = analyzeIdeas(text);
    if (parsedIdeas.length === 0) return setMessage("Aucune idée détectée.");

    const { error } = await supabase.from("ideas").insert(parsedIdeas);
    if (error) return setMessage("Erreur ajout idées : " + error.message);

    setMessage(`${parsedIdeas.length} idée(s) ajoutée(s) au journal ✅`);
    await loadIdeas();
  }

  async function toggleIdea(idea) {
    const { error } = await supabase
      .from("ideas")
      .update({ done: !idea.done })
      .eq("id", idea.id);

    if (error) return setMessage("Erreur idée : " + error.message);
    await loadIdeas();
  }

  async function deleteIdea(ideaId) {
    const { error } = await supabase.from("ideas").delete().eq("id", ideaId);
    if (error) return setMessage("Erreur suppression idée : " + error.message);
    await loadIdeas();
  }

  async function sendIdeaToTask(idea) {
  let tasks = [];

  const title = (idea.title || "").toLowerCase();

  if (title.includes("bananier")) {
    tasks = [
      "Trouver fournisseur",
      "Calculer budget",
      "Commander les plants",
      "Prévoir stockage",
      "Créer offre location",
    ];
  } else if (title.includes("poule") || title.includes("poulailler")) {
    tasks = [
      "Acheter matériel",
      "Préparer outils",
      "Installer la structure",
      "Vérifier sécurité",
      "Tester avec les animaux",
    ];
  } else if (title.includes("comptable") || title.includes("tva")) {
    tasks = [
      "Lister les questions",
      "Rassembler les documents",
      "Contacter le comptable",
      "Planifier un rendez-vous",
    ];
  } else {
    tasks = [
      idea.title,
      "Analyser le besoin",
      "Définir les actions",
      "Passer à l exécution",
    ];
  }

  const rows = tasks.map((taskTitle) => ({
    title: taskTitle,
    description: idea.title,
    category: idea.category,
    priority: idea.priority,
    date: new Date().toISOString().slice(0, 10),
    done: false,
    source: "idea_ai",
  }));

  const { error } = await supabase.from("tasks").insert(rows);

  if (error) {
    return setMessage("Erreur conversion idée → plan : " + error.message);
  }

  await supabase.from("ideas").update({ status: "envoyee_plan" }).eq("id", idea.id);

  setMessage(`Plan IA créé ( tâches) ✅`);

  await Promise.all([loadTasks(), loadIdeas()]);

  setActiveTab("plan");
  }

  if (!accessReady) {
    return <div className="privateSplash privateModuleScope">Ouverture de Tibaldo…</div>;
  }

  if (!session) {
    return (
      <div className="app loginApp">
        <div className="loginCard">
          <div className="brandCircle">T</div>
          <h1>Tibaldo OS</h1>
          <p>Connexion au stockage en ligne Supabase</p>

          <label>
            Email
            <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
          </label>

          <label>
            Mot de passe
            <input
              type="password"
              value={authPassword}
              placeholder="Mot de passe"
              onChange={(e) => setAuthPassword(e.target.value)}
            />
          </label>

          <div className="buttonRow">
            <button className="primary" onClick={signIn}>Se connecter</button>
          </div>

          {authMessage && <p className="message">{authMessage}</p>}
        </div>

        <style>{styles}</style>
      </div>
    );
  }

  if (!membership) {
    return (
      <main className="privateLogin privateModuleScope">
        <section>
          <p className="privateEyebrow">ACCÈS REFUSÉ</p>
          <h1>Ce compte n’est pas autorisé.</h1>
          <p>L’accès est vérifié côté serveur. La création libre de compte est désactivée.</p>
          <button className="privatePrimaryAction" onClick={signOut}>Se déconnecter</button>
        </section>
      </main>
    );
  }

  const workspace = workspaceForRole(membership.role);

  if (workspace === "DENIED") {
    return (
      <main className="privateLogin privateModuleScope">
        <section>
          <p className="privateEyebrow">ACCÈS REFUSÉ</p>
          <h1>Ce rôle n’est pas autorisé.</h1>
          <p>L’espace privé refuse tout rôle différent de Owner ou Personnel.</p>
          <button className="privatePrimaryAction" onClick={signOut}>Se déconnecter</button>
        </section>
      </main>
    );
  }

  if (workspace === "EMPLOYEE") {
    return (
      <div className="privateShell privateModuleScope employeeIntegratedShell">
        <header className="privateTopbar">
          <div className="brandButton"><span>T</span><strong>Tibaldo OS</strong></div>
          <div />
          <div className="topbarActions"><span className="roleBadge">Personnel</span><button onClick={signOut}>Déconnexion</button></div>
        </header>
        <EmployeePortal session={session} />
      </div>
    );
  }

  if (workspace !== "OWNER") return null;

  return (
    <div className="app">
      <div className="stickyTop">
        <header className="topHeader">
          <div className="brandMark">T</div>
          <div>
            <h1>Tibaldo OS</h1>
            <p>{session.user.email}</p>
          </div>
          <button className="logoutSmall" onClick={signOut}>Sortir</button>
        </header>

        <nav className="topNav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={[
                activeTab === tab.id ? "active" : "",
                tab.id === "opening" || tab.id === "team" ? "operationalTab" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => navigateToTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <small>{tab.label}</small>
            </button>
          ))}
        </nav>
      </div>

      <main className="content">
        {message && <div className="topMessage">{message}</div>}
        {loading && <div className="topMessage">Chargement Supabase...</div>}

        {activeTab === "home" && (
          <HomePageModule
            weights={weights}
            tasks={tasks}
            ideas={ideas}
            onGoPlan={() => setActiveTab("plan")}
            onGoIdeas={() => setActiveTab("ideas")}
            onGoSearch={() => setActiveTab("search")}
            onGoChatterie={() => setActiveTab("chatterie")}
            onGoAirbnb={() => setActiveTab("airbnb")}
            onGoPlus={() => setActiveTab("plus")}
          />
        )}

        {activeTab === "search" && (
          <SearchPageModule
            weights={weights}
            tasks={tasks}
            ideas={ideas}
            onGoPlan={() => setActiveTab("plan")}
            onGoIdeas={() => setActiveTab("ideas")}
            onGoChatterie={() => setActiveTab("chatterie")}
          />
        )}

        {activeTab === "plan" && (
          <PlanPageModule
            tasks={tasks}
            onToggleTask={toggleTask}
            onAddTask={addTask}
            onDeleteTask={deleteTask}
          />
        )}

        {activeTab === "ideas" && (
          <IdeasPageModule
            ideas={ideas}
            onAddIdeasFromText={addIdeasFromText}
            onToggleIdea={toggleIdea}
            onDeleteIdea={deleteIdea}
            onSendIdeaToTask={sendIdeaToTask}
          />
        )}

        {activeTab === "airbnb" && <AirbnbPage />}

        {activeTab === "universe" && <UniverseReactFlow />}

        {activeTab === "brain" && <BrainDashboardPage />}

        {activeTab === "menage" && <HousekeepingDashboard />}
        {activeTab === "payments" && <PaymentsPage />}
        {activeTab === "balances" && <BalancesPage />}
        {activeTab === "opening" && <OpeningControlCenter session={session} />}
        {activeTab === "team" && <OwnerTeamOverview />}
        {activeTab === "revenues" && <RevenuePage />}
        {activeTab === "finances" && <FinancesPage />}
        {activeTab === "bankimport" && <BankImportPage />}
        {activeTab === "fiscalite" && <AirbnbFiscalityPage />}

        {activeTab === "plus" && (
          <PlusPage
            session={session}
            weights={weights}
            tasks={tasks}
            ideas={ideas}
            onRefresh={loadAll}
            onSignOut={signOut}
          />
        )}
      </main>

      <style>{styles}</style>
    </div>
  );
}

function HomePage({ weights, tasks, ideas, onGoPlan, onGoIdeas, onGoSearch, onGoChatterie, onGoAirbnb, onGoPlus }) {
  const uzyWeights = weights.filter((w) => w.animal_key === "uzy");
  const lastUzy = uzyWeights[uzyWeights.length - 1];
  const openTasks = tasks.filter((t) => !t.done).length;
  const urgentTasks = tasks.filter((t) => !t.done && t.priority === "haute").length;
  const openIdeas = ideas.filter((i) => !i.done).length;

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Accueil</p>
        <h2>Bonjour Romain</h2>
        <p>Tibaldo OS est synchronisé avec Supabase : pesées, tâches, idées, recherche globale, Airbnb et tableau de bord ménage.</p>
      </div>

      <button className="searchHeroButton" onClick={onGoSearch}>🔎 Rechercher dans tout Tibaldo OS</button>

      <div className="dashGrid">
        <button className="statBig statButton" onClick={onGoChatterie}>
          <span>Pesées</span>
          <strong>{weights.length}</strong>
        </button>

        <button className="statBig statButton" onClick={onGoPlan}>
          <span>Tâches ouvertes</span>
          <strong>{openTasks}</strong>
        </button>

        <button className="statBig statButton" onClick={onGoPlan}>
          <span>Urgences</span>
          <strong>{urgentTasks}</strong>
        </button>

        <button className="statBig statButton" onClick={onGoIdeas}>
          <span>Idées ouvertes</span>
          <strong>{openIdeas}</strong>
        </button>
      </div>

      <div className="card">
        <p className="eyebrow">Airbnb</p>
        <h3>Recettes & PDF</h3>
        <p className="muted">Dépose un rapport PDF Airbnb pour analyser les recettes, les frais, les nuits et les logements.</p>
        <button className="primary" onClick={onGoAirbnb}>Ouvrir Airbnb</button>
      </div>

      <div className="card">
        <p className="eyebrow">Ménage</p>
        <h3>Tableau de bord prestations</h3>
        <p className="muted">Analyse les heures, achats, linge, admin/service client et coûts estimés.</p>
        <button className="secondaryButton" onClick={onGoPlus}>Ouvrir Plus → Ménage</button>
      </div>

      <div className="card">
        <p className="eyebrow">Uzy</p>
        <h3>Dernière pesée</h3>
        <p className="muted">
          {lastUzy ? `${lastUzy.weight} kg le ${formatDate(lastUzy.date)}` : "Aucune pesée enregistrée."}
        </p>
        <button className="secondaryButton" onClick={onGoChatterie}>Ouvrir Chatterie</button>
      </div>
    </section>
  );
}

function SearchPage({ weights, tasks, ideas, onGoPlan, onGoIdeas, onGoChatterie }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const taskResults = tasks.filter((task) =>
    q && [task.title, task.description, task.category, task.priority, task.date, task.time]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q)
  );

  const ideaResults = ideas.filter((idea) =>
    q && [idea.title, idea.description, idea.category, idea.priority, idea.status, idea.week_label]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q)
  );

  const weightResults = weights.filter((weight) =>
    q && [weight.animal_name, weight.animal_key, weight.weight, weight.date, weight.note]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q)
  );

  const total = taskResults.length + ideaResults.length + weightResults.length;

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Recherche globale</p>
        <h2>Rechercher dans Tibaldo OS</h2>
        <p>Recherche dans les tâches, les idées, le journal de bord et les pesées.</p>
      </div>

      <div className="card">
        <label>
          Mot-clé
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex : Uzy, comptable, Lyon, litière, bananier..."
          />
        </label>
        <p className="muted">
          {q ? `${total} résultat(s) trouvé(s) pour “${query}”.` : "Tape un mot pour chercher dans tout ton système."}
        </p>
      </div>

      {q && (
        <>
          <SearchBlock title="Tâches trouvées" eyebrow="Plan" onOpen={onGoPlan} empty="Aucune tâche trouvée.">
            {taskResults.map((task) => (
              <div className="searchItem" key={task.id}>
                <div className="taskMeta">
                  <span>{task.category || "Sans catégorie"}</span>
                  {task.date && <span>{formatDate(task.date)}</span>}
                  <span className={`priority ${task.priority || "moyenne"}`}>{task.priority || "moyenne"}</span>
                </div>
                <strong>{task.done ? "✅ " : ""}{task.title}</strong>
                {task.description && <p>{task.description}</p>}
              </div>
            ))}
          </SearchBlock>

          <SearchBlock title="Journal de bord" eyebrow="Idées" onOpen={onGoIdeas} empty="Aucune idée trouvée.">
            {ideaResults.map((idea) => (
              <div className="searchItem" key={idea.id}>
                <div className="taskMeta">
                  <span>{idea.category || "Sans catégorie"}</span>
                  <span className={`priority ${idea.priority || "moyenne"}`}>{idea.priority || "moyenne"}</span>
                  {idea.week_label && <span>{idea.week_label}</span>}
                </div>
                <strong>{idea.done ? "✅ " : ""}{idea.title}</strong>
                {idea.description && <p>{idea.description}</p>}
              </div>
            ))}
          </SearchBlock>

          <SearchBlock title="Pesées et notes" eyebrow="Chatterie" onOpen={onGoChatterie} empty="Aucune pesée trouvée.">
            {weightResults.map((weight) => (
              <div className="searchItem" key={weight.id}>
                <div className="taskMeta">
                  <span>{weight.animal_name || weight.animal_key}</span>
                  <span>{formatDate(weight.date)}</span>
                </div>
                <strong>{weight.weight} kg</strong>
                {weight.note && <p>{weight.note}</p>}
              </div>
            ))}
          </SearchBlock>
        </>
      )}
    </section>
  );
}

function SearchBlock({ eyebrow, title, onOpen, empty, children }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="card">
      <div className="cardTitleRow">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <button className="textButton" onClick={onOpen}>Ouvrir</button>
      </div>
      {!hasChildren ? <p className="muted">{empty}</p> : <div className="searchList">{children}</div>}
    </div>
  );
}

function PlanPage({ tasks, onToggleTask, onAddTask, onDeleteTask }) {
  const [filter, setFilter] = useState("Tous");
  const [openForm, setOpenForm] = useState(false);
  const categories = ["Tous", "Chatterie", "Airbnb", "Animaux", "Santé", "Perso", "Business", "Vacances", "Admin", "Maison", "Plantes", "Plus tard"];

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => filter === "Tous" || task.category === filter)
      .sort((a, b) => new Date(`${a.date || "2999-01-01"}T${a.time || "12:00"}`) - new Date(`${b.date || "2999-01-01"}T${b.time || "12:00"}`));
  }, [tasks, filter]);

  const done = tasks.filter((t) => t.done).length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Plan synchronisé</p>
        <h2>Agenda & tâches</h2>
        <p>Les tâches et cases cochées sont stockées dans Supabase.</p>
      </div>

      <div className="progressCard">
        <p className="eyebrow">Avancement</p>
        <h3>{percent}% terminé</h3>
        <p className="muted">{done} tâche(s) terminée(s) sur {tasks.length}</p>
        <div className="progressBar"><span style={{ width: `${percent}%` }} /></div>
      </div>

      <button className="primary fullWidth" onClick={() => setOpenForm(!openForm)}>
        {openForm ? "Fermer le formulaire" : "+ Ajouter une tâche"}
      </button>

      {openForm && <TaskForm onAddTask={onAddTask} onClose={() => setOpenForm(false)} />}

      <div className="filterBar">
        {categories.map((category) => (
          <button
            key={category}
            className={filter === category ? "selectedFilter" : ""}
            onClick={() => setFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="taskList">
        {filteredTasks.map((task) => (
          <div className={task.done ? "taskItem done" : "taskItem"} key={task.id}>
            <button className="checkButton" onClick={() => onToggleTask(task)}>
              {task.done ? "✓" : ""}
            </button>

            <div>
              <div className="taskMeta">
                <span>{task.category || "Sans catégorie"}</span>
                {task.date && <span>{formatDate(task.date)}{task.time ? ` · ${task.time}` : ""}</span>}
                <span className={`priority ${task.priority || "moyenne"}`}>{task.priority || "moyenne"}</span>
              </div>
              <strong>{task.title}</strong>
              {task.description && <p className="smallText">{task.description}</p>}
              <button className="deleteTiny" onClick={() => onDeleteTask(task.id)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskForm({ onAddTask, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Plus tard");
  const [priority, setPriority] = useState("moyenne");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!title.trim()) return alert("Entre un titre de tâche.");

    await onAddTask({
      title,
      description,
      category,
      priority,
      date,
      time: time || null,
      done: false,
      source: "manual",
    });

    onClose();
  }

  return (
    <form className="card" onSubmit={submit}>
      <p className="eyebrow">Nouvelle tâche</p>
      <h3>Ajouter au plan</h3>

      <label>
        Titre
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : appeler papa" />
      </label>

      <label>
        Catégorie
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {["Chatterie", "Airbnb", "Animaux", "Santé", "Perso", "Business", "Vacances", "Admin", "Maison", "Plantes", "Plus tard"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <label>
        Priorité
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="haute">haute</option>
          <option value="moyenne">moyenne</option>
          <option value="basse">basse</option>
        </select>
      </label>

      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <label>
        Heure
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>

      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <button className="primary fullWidth" type="submit">Enregistrer la tâche</button>
    </form>
  );
}

function IdeasPage({ ideas, onAddIdeasFromText, onToggleIdea, onDeleteIdea, onSendIdeaToTask }) {
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("Toutes");
  const categories = ["Toutes", "Chatterie", "Animaux", "Airbnb", "Admin", "Maison", "Plantes", "Business", "Vacances", "Perso", "Santé", "Plus tard"];
  const filteredIdeas = ideas.filter((idea) => filter === "Toutes" || idea.category === filter);
  const grouped = groupByWeek(filteredIdeas);

  async function submit(event) {
    event.preventDefault();
    if (!text.trim()) return alert("Colle une idée ou un dictaphone transcrit.");
    await onAddIdeasFromText(text);
    setText("");
  }

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Second cerveau</p>
        <h2>Déposer une idée</h2>
        <p>Colle une description, un dictaphone transcrit ou un brain dump.</p>
      </div>

      <form className="card ideaForm" onSubmit={submit}>
        <p className="eyebrow">Nouvelle entrée</p>
        <h3>Brain dump</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex : il faut appeler papa, réserver le TER pour Lyon, acheter de la litière..."
        />
        <button className="primary fullWidth" type="submit">Analyser et classer</button>
      </form>

      <div className="filterBar">
        {categories.map((category) => (
          <button
            key={category}
            className={filter === category ? "selectedFilter" : ""}
            onClick={() => setFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="card">
          <h3>Aucune idée pour l’instant</h3>
          <p className="muted">Colle ton premier texte.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([week, weekIdeas]) => (
          <div className="card" key={week}>
            <p className="eyebrow">Journal de bord</p>
            <h3>{week}</h3>

            <div className="ideaList">
              {weekIdeas.map((idea) => (
                <div className={idea.done ? "ideaItem done" : "ideaItem"} key={idea.id}>
                  <div className="ideaTop">
                    <button className="checkButton" onClick={() => onToggleIdea(idea)}>
                      {idea.done ? "✓" : ""}
                    </button>

                    <div>
                      <div className="taskMeta">
                        <span>{idea.category}</span>
                        <span className={`priority ${idea.priority}`}>{idea.priority}</span>
                        <span>{formatDateOnly(idea.created_at)}</span>
                      </div>
                      <strong>{idea.title}</strong>
                      <p>{idea.description}</p>

                      <div className="ideaActions">
                        <button onClick={() => onSendIdeaToTask(idea)}>→ Plan</button>
                        <button onClick={() => onDeleteIdea(idea.id)}>Supprimer</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function AirbnbPage() {
  const [reports, setReports] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(AIRBNB_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const [importMessage, setImportMessage] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState("Tous");
  const [yearFilter, setYearFilter] = useState("Tous");

  useEffect(() => {
    localStorage.setItem(AIRBNB_STORAGE_KEY, JSON.stringify(reports));
  }, [reports]);

  async function handlePdfUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoadingPdf(true);
    setImportMessage("Lecture du PDF Airbnb...");

    try {
      const text = await extractTextFromPdf(file);
      const parsed = parseAirbnbReportText(text, file.name);

      if (!parsed || !parsed.uniqueKey) {
        setImportMessage("Impossible d’analyser ce PDF. Essaie un rapport Airbnb texte, pas une capture/scanner.");
        setLoadingPdf(false);
        return;
      }

      const alreadyExists = reports.some((report) => report.uniqueKey === parsed.uniqueKey);

      if (alreadyExists) {
        setImportMessage("Doublon détecté : ce rapport semble déjà importé. Il n’a pas été ajouté une deuxième fois.");
        setLoadingPdf(false);
        return;
      }

      setReports((current) => [parsed, ...current]);
      setImportMessage(`Rapport importé ✅ ${parsed.year || "année non détectée"} · ${formatCurrency(parsed.summary.netTotal)} net`);
    } catch (error) {
      setImportMessage("Erreur lecture PDF : " + error.message);
    }

    setLoadingPdf(false);
    event.target.value = "";
  }

  function clearReports() {
    if (!confirm("Supprimer les rapports Airbnb importés localement ?")) return;
    setReports([]);
    localStorage.removeItem(AIRBNB_STORAGE_KEY);
  }

  const allPropertyLines = reports.flatMap((report) =>
    report.properties.map((line) => ({
      ...line,
      reportId: report.id,
      year: report.year,
      fileName: report.fileName,
    }))
  );

  const allMonthLines = reports.flatMap((report) =>
    report.months.map((line) => ({
      ...line,
      reportId: report.id,
      year: report.year,
      fileName: report.fileName,
    }))
  );

  const years = ["Tous", ...unique(reports.map((report) => String(report.year || "Non détectée")))];
  const properties = ["Tous", ...unique(allPropertyLines.map((line) => line.normalizedProperty))];

  const filteredPropertyLines = allPropertyLines.filter((line) => {
    if (propertyFilter !== "Tous" && line.normalizedProperty !== propertyFilter) return false;
    if (yearFilter !== "Tous" && String(line.year || "Non détectée") !== yearFilter) return false;
    return true;
  });

  const filteredReports = reports.filter((report) => {
    if (yearFilter !== "Tous" && String(report.year || "Non détectée") !== yearFilter) return false;
    return true;
  });

  const kpis = useMemo(() => {
    const gross = sum(filteredPropertyLines.map((line) => line.grossRevenue));
    const fees = sum(filteredPropertyLines.map((line) => line.serviceFees));
    const adjustments = sum(filteredPropertyLines.map((line) => line.adjustments));
    const net = sum(filteredPropertyLines.map((line) => line.netTotal));
    const nights = sum(filteredPropertyLines.map((line) => line.nights));
    const avgPerNight = nights ? net / nights : 0;

    return {
      reports: filteredReports.length,
      gross,
      fees,
      adjustments,
      net,
      nights,
      avgPerNight,
      properties: unique(filteredPropertyLines.map((line) => line.normalizedProperty)).length,
    };
  }, [filteredPropertyLines, filteredReports]);

  const byProperty = useMemo(() => {
    const map = {};

    filteredPropertyLines.forEach((line) => {
      const name = line.normalizedProperty || "Non classé";

      if (!map[name]) {
        map[name] = {
          name,
          grossRevenue: 0,
          serviceFees: 0,
          adjustments: 0,
          netTotal: 0,
          nights: 0,
          lines: 0,
        };
      }

      map[name].grossRevenue += line.grossRevenue || 0;
      map[name].serviceFees += line.serviceFees || 0;
      map[name].adjustments += line.adjustments || 0;
      map[name].netTotal += line.netTotal || 0;
      map[name].nights += line.nights || 0;
      map[name].lines += 1;
    });

    return Object.values(map).sort((a, b) => b.netTotal - a.netTotal);
  }, [filteredPropertyLines]);

  const byMonth = useMemo(() => {
    const map = {};

    allMonthLines
      .filter((line) => yearFilter === "Tous" || String(line.year || "Non détectée") === yearFilter)
      .forEach((line) => {
        const name = `${line.month} ${line.year || ""}`.trim();

        if (!map[name]) {
          map[name] = {
            name,
            grossRevenue: 0,
            netTotal: 0,
            lines: 0,
          };
        }

        map[name].grossRevenue += line.grossRevenue || 0;
        map[name].netTotal += line.netTotal || 0;
        map[name].lines += 1;
      });

    return Object.values(map);
  }, [allMonthLines, yearFilter]);

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Airbnb</p>
        <h2>Recettes & reportings PDF</h2>
        <p>Importe tes rapports Airbnb PDF pour analyser les revenus, les frais, le net versé, les nuits et les logements.</p>
      </div>

      <div className="card">
        <div className="cardTitleRow">
          <div>
            <p className="eyebrow">Import PDF</p>
            <h3>Déposer un rapport Airbnb</h3>
          </div>

          <label className="fileButton">
            {loadingPdf ? "Lecture..." : "Choisir PDF"}
            <input type="file" accept="application/pdf" onChange={handlePdfUpload} />
          </label>
        </div>

        <p className="muted">
          Règles : Chambre 1/2/3/4 = Fives · Chambre côté jardin/rue + Logement entier = Melezio · Wattignies = Wattignies.
        </p>

        {importMessage && <p className="message">{importMessage}</p>}
      </div>

      <div className="filtersPanel">
        <label>
          Année
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            {years.map((year) => <option key={year}>{year}</option>)}
          </select>
        </label>

        <label>
          Logement
          <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
            {properties.map((property) => <option key={property}>{property}</option>)}
          </select>
        </label>

        <div className="buttonRow alignBottom">
          <button className="secondaryButton" onClick={() => { setYearFilter("Tous"); setPropertyFilter("Tous"); }}>Reset filtres</button>
          <button className="dangerButton" onClick={clearReports}>Vider imports</button>
        </div>
      </div>

      <div className="kpiGrid">
        <KpiCard icon="📄" label="Rapports" value={kpis.reports} />
        <KpiCard icon="💶" label="Revenus bruts" value={formatCurrency(kpis.gross)} />
        <KpiCard icon="📉" label="Frais Airbnb" value={formatCurrency(kpis.fees)} />
        <KpiCard icon="🔁" label="Régularisations" value={formatCurrency(kpis.adjustments)} />
        <KpiCard icon="💰" label="Net versé" value={formatCurrency(kpis.net)} />
        <KpiCard icon="🌙" label="Nuits réservées" value={formatNumber(kpis.nights)} />
        <KpiCard icon="📊" label="Net / nuit" value={formatCurrency(kpis.avgPerNight)} />
        <KpiCard icon="🏠" label="Logements" value={kpis.properties} />
      </div>

      <div className="dashboardSplit">
        <div className="miniDashboard">
          <p className="eyebrow">Répartition</p>
          <h3>Par logement</h3>
          {byProperty.length === 0 ? (
            <p className="muted">Aucun PDF importé.</p>
          ) : (
            <div className="summaryList">
              {byProperty.map((item) => (
                <div className="summaryItem" key={item.name}>
                  <strong>{item.name}</strong>
                  <span>Net : {formatCurrency(item.netTotal)}</span>
                  <span>Brut : {formatCurrency(item.grossRevenue)} · Frais : {formatCurrency(item.serviceFees)}</span>
                  <span>Nuits : {formatNumber(item.nights)} · Net/nuit : {formatCurrency(item.nights ? item.netTotal / item.nights : 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="miniDashboard">
          <p className="eyebrow">Période</p>
          <h3>Par mois</h3>
          {byMonth.length === 0 ? (
            <p className="muted">Aucun mois détecté.</p>
          ) : (
            <div className="summaryList">
              {byMonth.map((month) => (
                <div className="summaryItem" key={month.name}>
                  <strong>{month.name}</strong>
                  <span>Net : {formatCurrency(month.netTotal)}</span>
                  <span>Brut : {formatCurrency(month.grossRevenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="tableWrap">
        <p className="eyebrow">Détail</p>
        <h3>Lignes logements importées</h3>

        <table className="dataTable">
          <thead>
            <tr>
              <th>Année</th>
              <th>Ligne Airbnb</th>
              <th>Classement</th>
              <th>Brut</th>
              <th>Régul.</th>
              <th>Frais</th>
              <th>Net</th>
              <th>Nuits</th>
              <th>Fichier</th>
            </tr>
          </thead>
          <tbody>
            {filteredPropertyLines.map((line, index) => (
              <tr key={`${line.reportId}-${line.label}-${index}`}>
                <td>{line.year || "—"}</td>
                <td>{line.label}</td>
                <td>{line.normalizedProperty}</td>
                <td>{formatCurrency(line.grossRevenue)}</td>
                <td>{formatCurrency(line.adjustments)}</td>
                <td>{formatCurrency(line.serviceFees)}</td>
                <td>{formatCurrency(line.netTotal)}</td>
                <td>{formatNumber(line.nights)}</td>
                <td>{line.fileName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <p className="eyebrow">Historique local</p>
        <h3>Rapports importés</h3>
        {reports.length === 0 ? (
          <p className="muted">Aucun rapport importé pour l’instant.</p>
        ) : (
          <div className="summaryList">
            {reports.map((report) => (
              <div className="summaryItem" key={report.id}>
                <strong>{report.year || "Année non détectée"} · {report.fileName}</strong>
                <span>Net : {formatCurrency(report.summary.netTotal)} · Brut : {formatCurrency(report.summary.grossRevenue)}</span>
                <span>Frais : {formatCurrency(report.summary.serviceFees)} · Nuits : {formatNumber(report.summary.nights)}</span>
                <span>Import local : {new Date(report.importedAt).toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    pages.push(pageText);
  }

  return pages.join("\n");
}

function parseAirbnbReportText(text, fileName) {
  const clean = normalizePdfText(text);
  const year = detectAirbnbYear(clean);
  const summary = parseAirbnbSummary(clean);
  const properties = parseAirbnbPropertyLines(clean);
  const months = parseAirbnbMonths(clean);
  const nightsByLabel = parseAirbnbNights(clean);
  const totalNightsFromProperties = sum(Object.values(nightsByLabel));
  summary.nights = totalNightsFromProperties || summary.nights;

  const enrichedProperties = properties.map((line) => {
    const nights = nightsByLabel[normalizeText(line.label)] || 0;

    return {
      ...line,
      normalizedProperty: classifyAirbnbProperty(line.label),
      nights,
    };
  });

  const uniqueKey = [
    year || "unknown",
    roundKey(summary.grossRevenue),
    roundKey(summary.netTotal),
    roundKey(summary.serviceFees),
    summary.nights || 0,
    enrichedProperties.map((line) => `${line.label}:${roundKey(line.netTotal)}`).join("|"),
  ].join("__");

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    fileName,
    importedAt: new Date().toISOString(),
    year,
    uniqueKey,
    summary,
    properties: enrichedProperties,
    months,
    rawTextPreview: clean.slice(0, 1500),
  };
}

function normalizePdfText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectAirbnbYear(text) {
  const yearAtStart = text.match(/\b(20\d{2})\b/);
  return yearAtStart ? Number(yearAtStart[1]) : null;
}

function parseAirbnbSummary(text) {
  const summaryMatch = text.match(/Revenus\s+(-?[\d\s.,]+)\s*€\s+(-?[\d\s.,]+)\s*€\s+(-?[\d\s.,]+)\s*€\s+(-?[\d\s.,]+)\s*€\s+(-?[\d\s.,]+)\s*€/i);
  const nightsMatch = text.match(/Nuits réservées\s+(\d+)/i);
  const taxesMatch = text.match(/Taxes reversées par Airbnb\s*:\s*([\d\s.,]+)\s*€/i);

  return {
    grossRevenue: summaryMatch ? parseEuro(summaryMatch[1]) : 0,
    adjustments: summaryMatch ? parseEuro(summaryMatch[2]) : 0,
    serviceFees: summaryMatch ? parseEuro(summaryMatch[3]) : 0,
    taxWithheld: summaryMatch ? parseEuro(summaryMatch[4]) : 0,
    netTotal: summaryMatch ? parseEuro(summaryMatch[5]) : 0,
    nights: nightsMatch ? Number(nightsMatch[1]) : 0,
    taxesPaidByAirbnb: taxesMatch ? parseEuro(taxesMatch[1]) : 0,
  };
}

function parseAirbnbPropertyLines(text) {
  const labels = [
    "Logement entier",
    "Chambre 2",
    "Chambre côté jardin",
    "Chambre 3",
    "Chambre côté rue",
    "Chambre 4",
    "Wattignies",
    "Chambre 1",
  ];

  return labels.map((label) => {
    const escaped = escapeRegExp(label);
    const regex = new RegExp(`${escaped}\\s+(-?[\\d\\s.,]+)\\s*€\\s+(-?[\\d\\s.,]+)\\s*€\\s+(-?[\\d\\s.,]+)\\s*€\\s+(-?[\\d\\s.,]+)\\s*€\\s+(-?[\\d\\s.,]+)\\s*€`, "i");
    const match = text.match(regex);

    if (!match) return null;

    return {
      label,
      grossRevenue: parseEuro(match[1]),
      adjustments: parseEuro(match[2]),
      serviceFees: parseEuro(match[3]),
      taxWithheld: parseEuro(match[4]),
      netTotal: parseEuro(match[5]),
    };
  }).filter(Boolean);
}

function parseAirbnbMonths(text) {
  const months = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];

  return months.map((month) => {
    const regex = new RegExp(`${month}\\s+(-?[\\d\\s.,]+)\\s*€\\s+(-?[\\d\\s.,]+)\\s*€`, "i");
    const match = text.match(regex);

    if (!match) return null;

    return {
      month,
      grossRevenue: parseEuro(match[1]),
      netTotal: parseEuro(match[2]),
    };
  }).filter(Boolean);
}

function parseAirbnbNights(text) {
  const result = {};

  const performanceStart = text.indexOf("Statistiques de performance Logement Nuits réservées");
  const performanceText = performanceStart >= 0 ? text.slice(performanceStart) : text;

  const patterns = [
    { label: "Logement entier", regex: /Logement entier\s+(\d+)\s+[\d.,]+/i },
    { label: "Chambre 2", regex: /Chambre 2\s+(\d+)\s+[\d.,]+/i },
    { label: "Chambre côté jardin", regex: /Chambre côté jardin\s+(\d+)\s+[\d.,]+/i },
    { label: "Chambre 3", regex: /Chambre 3\s+(\d+)\s+[\d.,]+/i },
    { label: "Chambre côté rue", regex: /Chambre côté rue\s+(\d+)\s+[\d.,]+/i },
    { label: "Chambre 4", regex: /Chambre 4\s+(\d+)\s+[\d.,]+/i },
    { label: "Wattignies", regex: /Wattignies\s+(\d+)\s+[\d.,]+/i },
    { label: "Chambre 1", regex: /Chambre 1\s+(\d+)\s+[\d.,]+/i },
  ];

  patterns.forEach((item) => {
    const match = performanceText.match(item.regex);
    result[normalizeText(item.label)] = match ? Number(match[1]) : 0;
  });

  return result;
}

function classifyAirbnbProperty(label) {
  const t = normalizeText(label);

  if (t.includes("chambre 1")) return "Fives";
  if (t.includes("chambre 2")) return "Fives";
  if (t.includes("chambre 3")) return "Fives";
  if (t.includes("chambre 4")) return "Fives";

  if (t.includes("cote jardin")) return "Melezio";
  if (t.includes("cote rue")) return "Melezio";
  if (t.includes("logement entier")) return "Melezio";
  if (t.includes("melezio")) return "Melezio";

  if (t.includes("wattignies")) return "Wattignies";

  return "Non classé";
}

function parseEuro(value) {
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace("€", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function roundKey(value) {
  return Math.round((Number(value) || 0) * 100);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ChatteriePage({ animals, selectedAnimalKey, setSelectedAnimalKey, weights, onAddWeight, onRefresh }) {
  const selectedAnimal = animals.find((animal) => animal.key === selectedAnimalKey);
  const selectedWeights = useMemo(() => {
    return weights
      .filter((weight) => weight.animal_key === selectedAnimalKey)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [weights, selectedAnimalKey]);

  const lastWeight = selectedWeights[selectedWeights.length - 1];
  const previousWeight = selectedWeights[selectedWeights.length - 2];
  const diff = lastWeight && previousWeight ? Number(lastWeight.weight) - Number(previousWeight.weight) : null;

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Chatterie connectée</p>
        <h2>Suivi Bengals</h2>
        <p>Les pesées sont enregistrées en ligne dans Supabase.</p>
      </div>

      <div className="animalSelector">
        {animals.map((animal) => (
          <button
            key={animal.key}
            className={selectedAnimalKey === animal.key ? "selected" : ""}
            onClick={() => setSelectedAnimalKey(animal.key)}
          >
            <span>{animal.emoji}</span>
            <strong>{animal.name}</strong>
          </button>
        ))}
      </div>

      <div className="card animalCard">
        <div className="animalEmoji">{selectedAnimal.emoji}</div>
        <div>
          <p className="eyebrow">Fiche animal</p>
          <h3>{selectedAnimal.name}</h3>
          <p className="muted">{selectedAnimal.type}</p>
          <p className="muted">{selectedAnimal.status}</p>
        </div>
      </div>

      <WeightForm selectedAnimal={selectedAnimal} onAddWeight={onAddWeight} />

      <div className="statsRow">
        <div className="statCard">
          <span>Dernière pesée</span>
          <strong>{lastWeight ? `${lastWeight.weight} kg` : "—"}</strong>
        </div>

        <div className="statCard">
          <span>Variation</span>
          <strong className={diff < 0 ? "danger" : "ok"}>
            {diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(3)} kg`}
          </strong>
        </div>
      </div>

      <div className="card">
        <div className="cardTitleRow">
          <div>
            <p className="eyebrow">Synchronisation</p>
            <h3>{selectedWeights.length} pesée(s)</h3>
          </div>
          <button className="textButton" onClick={onRefresh}>Rafraîchir</button>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">Courbe</p>
        <h3>Évolution du poids</h3>
        <WeightChart weights={selectedWeights} />
      </div>

      <div className="card">
        <p className="eyebrow">Historique</p>
        <h3>Pesées en ligne</h3>
        <WeightHistory weights={selectedWeights} />
      </div>
    </section>
  );
}

function WeightForm({ selectedAnimal, onAddWeight }) {
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!weight || Number(weight) <= 0) return alert("Entre un poids valide, exemple : 4.850");

    await onAddWeight({
      animalKey: selectedAnimal.key,
      animalName: selectedAnimal.name,
      date,
      weight,
      note,
    });

    setWeight("");
    setNote("");
    setOpen(false);
  }

  return (
    <div className="card formCard">
      {!open ? (
        <button className="primary fullWidth" onClick={() => setOpen(true)}>+ Ajouter une pesée</button>
      ) : (
        <form onSubmit={submit}>
          <div className="cardTitleRow">
            <div>
              <p className="eyebrow">Nouvelle pesée</p>
              <h3>{selectedAnimal.name}</h3>
            </div>
            <button type="button" className="textButton" onClick={() => setOpen(false)}>Fermer</button>
          </div>

          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label>
            Poids en kg
            <input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Ex : 4.850" />
          </label>

          <label>
            Note
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : mange bien, calme..." />
          </label>

          <button className="primary fullWidth" type="submit">Enregistrer dans Supabase</button>
        </form>
      )}
    </div>
  );
}

function WeightChart({ weights }) {
  if (weights.length === 0) return <p className="muted">Aucune donnée à afficher.</p>;

  const numbers = weights.map((w) => Number(w.weight));
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const range = Math.max(max - min, 0.1);

  const points = weights.map((w, index) => {
    const x = weights.length === 1 ? 50 : (index / (weights.length - 1)) * 100;
    const y = 88 - ((Number(w.weight) - min) / range) * 68;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" />
        {weights.map((w, index) => {
          const x = weights.length === 1 ? 50 : (index / (weights.length - 1)) * 100;
          const y = 88 - ((Number(w.weight) - min) / range) * 68;
          return <circle key={w.id} cx={x} cy={y} r="2.3" fill="currentColor" />;
        })}
      </svg>

      <div className="chartLabels">
        {weights.map((w) => <span key={w.id}>{shortDate(w.date)} · {w.weight} kg</span>)}
      </div>
    </div>
  );
}

function WeightHistory({ weights }) {
  if (weights.length === 0) return <p className="muted">Aucune pesée en ligne.</p>;

  return (
    <div className="history">
      {[...weights].reverse().map((weight, index, list) => {
        const previous = list[index + 1];
        const diff = previous ? Number(weight.weight) - Number(previous.weight) : null;

        return (
          <div className="historyItem" key={weight.id}>
            <div>
              <strong>{weight.weight} kg</strong>
              <span>{formatDate(weight.date)}</span>
            </div>
            <div className="historyRight">
              <strong className={diff < 0 ? "danger" : "ok"}>
                {diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(3)} kg`}
              </strong>
              <span>{weight.note || "—"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlusPage({ session, weights, tasks, ideas, onRefresh, onSignOut }) {
  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Paramètres & outils</p>
        <h2>Supabase + ménage</h2>
        <p>Ton stockage en ligne est actif, et le tableau de bord ménage lit ton Google Sheet public.</p>
      </div>

      <div className="card">
        <p className="eyebrow">Compte</p>
        <h3>{session.user.email}</h3>
        <p className="muted">{weights.length} pesée(s), {tasks.length} tâche(s), {ideas.length} idée(s).</p>

        <div className="buttonRow">
          <button className="secondaryButton" onClick={onRefresh}>Rafraîchir</button>
          <button className="dangerButton" onClick={onSignOut}>Se déconnecter</button>
        </div>
      </div>

      <HousekeepingDashboard />
    </section>
  );
}

function HousekeepingDashboard() {
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetMessage, setSheetMessage] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("Tous");
  const [propertyFilter, setPropertyFilter] = useState("Tous");
  const [typeFilter, setTypeFilter] = useState("Tous");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hourlyRate, setHourlyRate] = useState("15");
  const [linenRate, setLinenRate] = useState("3");

  async function loadSheet() {
    setLoadingSheet(true);
    setSheetMessage("Chargement du Google Sheet...");

    try {
      const response = await fetch(SHEET_CSV_URL);
      const csvText = await response.text();
      const parsed = parseCSV(csvText);

      setColumns(parsed.columns);
      setRows(parsed.rows);
      setSheetMessage(`${parsed.rows.length} ligne(s) chargée(s) ✅`);
    } catch (error) {
      setSheetMessage("Erreur chargement Google Sheet : " + error.message);
    }

    setLoadingSheet(false);
  }

  const mapping = useMemo(() => detectHousekeepingColumns(columns), [columns]);

  const enrichedRows = useMemo(() => rows.map((row, index) => {
    const dateValue = getCell(row, mapping.date);
    const employee = normalizeEmployeeName(getCell(row, mapping.employee));
    const property = normalizePropertyName(getCell(row, mapping.property));
    const minutes = parseFrenchNumber(getFirstNonEmptyCell(row, mapping.minuteColumns && mapping.minuteColumns.length ? mapping.minuteColumns : [mapping.minutes]));
    const hours = minutes / 60;
    const purchases = parseFrenchNumber(getCell(row, mapping.purchases));
    const products = getCell(row, mapping.products);
    const receipt = getCell(row, mapping.receipt);
    const roomsText = getCell(row, mapping.rooms);
    const remarks = getCell(row, mapping.remarks);
    const linenPresence = getCell(row, mapping.linenPresence);
    const linenCleaned = parseFrenchNumber(getCell(row, mapping.linenCleaned));
    const type = inferHousekeepingServiceType(row, mapping, employee, property, roomsText, getCell(row, mapping.surfaces), remarks, linenCleaned);
    const surfaces = getCell(row, mapping.surfaces);
    const parsedDate = parseAnyDate(dateValue);
    const roomCount = countRooms(roomsText);
    const anomaly = detectAnomaly(`${remarks} ${linenPresence} ${surfaces}`);
    const dayLabel = parsedDate ? parsedDate.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" }) : "Sans date";
    const isAdmin = isAdminService(type, remarks, products);
    return {
      id: index,
      raw: row,
      dateValue,
      parsedDate,
      dayLabel,
      employee,
      property,
      minutes,
      hours,
      purchases,
      products,
      receipt,
      roomsText,
      remarks,
      linenPresence,
      linenCleaned,
      type,
      surfaces,
      roomCount,
      anomaly,
      isAdmin,
      searchable: Object.values(row).join(" ").toLowerCase(),
    };
  }), [rows, mapping]);

  const employees = useMemo(() => ["Tous", ...unique(enrichedRows.map((row) => row.employee))], [enrichedRows]);
  const properties = useMemo(() => ["Tous", ...unique(enrichedRows.map((row) => row.property))], [enrichedRows]);
  const types = useMemo(() => ["Tous", ...unique(enrichedRows.map((row) => row.type).filter(Boolean))], [enrichedRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return enrichedRows.filter((row) => {
      if (employeeFilter !== "Tous" && row.employee !== employeeFilter) return false;
      if (propertyFilter !== "Tous" && row.property !== propertyFilter) return false;
      if (typeFilter !== "Tous" && row.type !== typeFilter) return false;

      if (startDate && row.parsedDate) {
        const start = new Date(startDate + "T00:00:00");
        if (row.parsedDate < start) return false;
      }

      if (endDate && row.parsedDate) {
        const end = new Date(endDate + "T23:59:59");
        if (row.parsedDate > end) return false;
      }

      if (q && !row.searchable.includes(q)) return false;

      return true;
    });
  }, [enrichedRows, employeeFilter, propertyFilter, typeFilter, search, startDate, endDate]);

  const hourly = parseFrenchNumber(hourlyRate);
  const linenUnit = parseFrenchNumber(linenRate);

  const kpis = useMemo(() => {
    const totalMinutes = sum(filteredRows.map((row) => row.minutes));
    const totalHours = totalMinutes / 60;
    const purchases = sum(filteredRows.map((row) => row.purchases));
    const linenCleaned = sum(filteredRows.map((row) => row.linenCleaned));
    const linenPay = linenCleaned * linenUnit;
    const laborEstimate = totalHours * hourly;
    const totalToPayEstimate = laborEstimate + linenPay + purchases;
    const interventions = filteredRows.length;
    const rooms = sum(filteredRows.map((row) => row.roomCount));
    const anomalies = filteredRows.filter((row) => row.anomaly).length;
    const adminMissions = filteredRows.filter((row) => row.isAdmin).length;
    const adminHours = sum(filteredRows.filter((row) => row.isAdmin).map((row) => row.hours));
    const avgMinutes = interventions ? totalMinutes / interventions : 0;
    const rowsWithPurchases = filteredRows.filter((row) => row.purchases > 0).length;

    return {
      interventions,
      totalMinutes,
      totalHours,
      purchases,
      rowsWithPurchases,
      laborEstimate,
      linenCleaned,
      linenPay,
      totalToPayEstimate,
      rooms,
      anomalies,
      adminMissions,
      adminHours,
      avgMinutes,
      employees: unique(filteredRows.map((row) => row.employee)).length,
      properties: unique(filteredRows.map((row) => row.property)).length,
    };
  }, [filteredRows, hourly, linenUnit]);

  const byEmployee = useMemo(() => groupSummaryHousekeeping(filteredRows, "employee", hourly, linenUnit), [filteredRows, hourly, linenUnit]);
  const byProperty = useMemo(() => groupSummaryHousekeeping(filteredRows, "property", hourly, linenUnit), [filteredRows, hourly, linenUnit]);
  
const byProduct = useMemo(() => groupProducts(filteredRows), [filteredRows]);

  const anomalies = filteredRows.filter((row) => row.anomaly);
  const purchaseAlerts = filteredRows.filter((row) => row.purchases > 0 || normalizeText(row.products).includes("oui"));

  return (
    <div className="card housekeepingDashboard">
      <div className="cardTitleRow">
        <div>
          <p className="eyebrow">Ménage</p>
          <h3>Tableau de bord femmes de ménage</h3>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="primary" onClick={loadSheet}>
            {loadingSheet ? "Chargement..." : "Charger Google Sheet"}
          </button>

          {/* Synchronisation automatique activée */}
        </div>
      </div>

      {sheetMessage && <p className="message">{sheetMessage}</p>}

      {rows.length > 0 && (
        <>
          <div className="filtersPanel">
            <label>
              Date début
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>

            <label>
              Date fin
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>

            <label>
              Salarié
              <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
                {employees.map((employee) => <option key={employee}>{employee}</option>)}
              </select>
            </label>

            <label>
              Logement
              <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
                {properties.map((property) => <option key={property}>{property}</option>)}
              </select>
            </label>

            <label>
              Type de prestation
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {types.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>

            <label>
              Taux horaire
              <input value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
            </label>

            <label>
              Prix par jeu de linge
              <input value={linenRate} onChange={(e) => setLinenRate(e.target.value)} />
            </label>

            <label className="wideFilter">
              Recherche libre
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ex : Fives, Mélézio, Gaëlle, lit non défait, ticket..."
              />
            </label>
          </div>

          <div className="kpiGrid">
            <KpiCard icon="🧾" label="Interventions" value={kpis.interventions} />
            <KpiCard icon="⏱️" label="Temps total" value={`${formatNumber(kpis.totalHours)} h`} />
            <KpiCard icon="🕒" label="Moyenne / prestation" value={`${formatNumber(kpis.avgMinutes)} min`} />
            <KpiCard icon="🏠" label="Logements" value={kpis.properties} />
            <KpiCard icon="👥" label="Prestataires" value={kpis.employees} />
            <KpiCard icon="🛏️" label="Chambres préparées" value={kpis.rooms} />
            <KpiCard icon="🧺" label="Jeux linge" value={formatNumber(kpis.linenCleaned)} />
            <KpiCard icon="💶" label="Paie linge" value={formatCurrency(kpis.linenPay)} />
            <KpiCard icon="🧴" label="Achats" value={formatCurrency(kpis.purchases)} />
            <KpiCard icon="📌" label="Lignes achats" value={kpis.rowsWithPurchases} />
            <KpiCard icon="💰" label="Total estimé" value={formatCurrency(kpis.totalToPayEstimate)} />
            <KpiCard icon="⚠️" label="Alertes" value={kpis.anomalies} />
            <KpiCard icon="📞" label="Admin/service client" value={kpis.adminMissions} />
            <KpiCard icon="🕘" label="Heures admin" value={`${formatNumber(kpis.adminHours)} h`} />
            <KpiCard icon="💶" label="Paie horaire" value={formatCurrency(kpis.laborEstimate)} />
            <KpiCard icon="📍" label="Taux horaire" value={`${formatNumber(hourly)} €/h`} />
          </div>

          <div className="dashboardSplit">
            <div className="miniDashboard">
              <p className="eyebrow">Répartition</p>
              <h3>Par salarié</h3>
              <SummaryList data={byEmployee} />
            </div>

            <div className="miniDashboard">
              <p className="eyebrow">Répartition</p>
              <h3>Par logement</h3>
              <SummaryList data={byProperty} />
            </div>
          </div>

          <div className="miniDashboard">
            <p className="eyebrow">Achats</p>
            <h3>Produits déclarés / tickets</h3>

            {byProduct.length === 0 ? (
              <p className="muted">Aucun achat détecté dans les lignes filtrées.</p>
            ) : (
              <div className="summaryList">
                {byProduct.map((item) => (
                  <div className="summaryItem" key={item.name}>
                    <strong>{item.name}</strong>
                    <span>{item.count} ligne(s) · {formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {purchaseAlerts.length > 0 && (
              <div className="summaryList purchaseList">
                {purchaseAlerts.slice(0, 10).map((row) => (
                  <div className="summaryItem" key={row.id}>
                    <strong>{row.dayLabel} · {row.employee} · {row.property}</strong>
                    <span>Produits : {row.products || "non renseigné"}</span>
                    <span>Montant : {formatCurrency(row.purchases)}</span>
                    {row.receipt && <a href={row.receipt} target="_blank" rel="noreferrer">Ouvrir ticket</a>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="miniDashboard">
            <p className="eyebrow">Alertes utiles</p>
            <h3>Anomalies / remarques importantes</h3>

            {anomalies.length === 0 ? (
              <p className="muted">Aucune anomalie détectée dans les lignes filtrées.</p>
            ) : (
              <div className="summaryList">
                {anomalies.slice(0, 12).map((row) => (
                  <div className="summaryItem alertItem" key={row.id}>
                    <strong>{row.dayLabel} · {row.employee} · {row.property}</strong>
                    <span>{row.remarks || row.linenPresence || "Remarque non renseignée"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="tableWrap">
            <p className="eyebrow">Détail</p>
            <h3>Lignes filtrées</h3>

            <table className="dataTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Salarié</th>
                  <th>Logement</th>
                  <th>Type</th>
                  <th>Minutes</th>
                  <th>Heures</th>
                  <th>Chambres</th>
                  <th>Jeux linge</th>
                  <th>Linge OK</th>
                  <th>Achats</th>
                  <th>Produits</th>
                  <th>Remarques</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.slice(0, 150).map((row) => (
                  <tr key={row.id}>
                    <td>{row.dateValue || "—"}</td>
                    <td>{row.employee}</td>
                    <td>{row.property}</td>
                    <td>{row.type || "—"}</td>
                    <td>{formatNumber(row.minutes)}</td>
                    <td>{formatNumber(row.hours)}</td>
                    <td>{row.roomsText || "—"}</td>
                    <td>{formatNumber(row.linenCleaned)}</td>
                    <td>{row.linenPresence || "—"}</td>
                    <td>{formatCurrency(row.purchases)}</td>
                    <td>{row.products || "—"}</td>
                    <td>{row.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="detectedColumns">
            <p className="eyebrow">Colonnes utilisées</p>
            <p className="muted">
              Date : <strong>{mapping.date || "non détectée"}</strong><br />
              Salarié : <strong>{mapping.employee || "non détectée"}</strong><br />
              Temps : <strong>{mapping.minutes || "non détectée"}</strong><br />
              Logement : <strong>{mapping.property || "non détectée"}</strong><br />
              Chambres : <strong>{mapping.rooms || "non détectée"}</strong><br />
              Linge OK : <strong>{mapping.linenPresence || "non détectée"}</strong><br />
              Jeux linge : <strong>{mapping.linenCleaned || "non détectée"}</strong><br />
              Achats : <strong>{mapping.purchases || "non détectée"}</strong><br />
              Produits : <strong>{mapping.products || "non détectée"}</strong><br />
              Tickets : <strong>{mapping.receipt || "non détectée"}</strong><br />
              Type : <strong>{mapping.type || "non détectée"}</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }) {
  return (
    <div className="kpiCard">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryList({ data }) {
  if (data.length === 0) return <p className="muted">Aucune donnée.</p>;

  return (
    <div className="summaryList">
      {data.map((item) => (
        <div className="summaryItem" key={item.name}>
          <strong>{item.name}</strong>
          <span>{item.count} intervention(s)</span>
          <span>{formatNumber(item.hours)} h · {item.rooms} chambre(s) · {formatCurrency(item.purchases)} achats</span>
          <span>Linge : {formatNumber(item.linenCleaned)} jeu(x) · {formatCurrency(item.linenPay)}</span>
          <span>Paie horaire : {formatCurrency(item.laborEstimate)}</span>
        </div>
      ))}
    </div>
  );
}

function parseCSV(csvText) {
  const lines = [];
  let current = "";
  let row = [];
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (current || row.length) {
        row.push(current);
        lines.push(row);
        row = [];
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current);
    lines.push(row);
  }

  const rawColumns = (lines[0] || []).map((header, index) => {
    const clean = String(header || "").trim();
    return clean || `Colonne ${index + 1}`;
  });

  const seen = {};
  const columns = rawColumns.map((column) => {
    const base = column.trim();

    if (!seen[base]) {
      seen[base] = 1;
      return base;
    }

    seen[base] += 1;
    return `${base} __${seen[base]}`;
  });

  const rows = lines.slice(1).map((line) => {
    const obj = {};

    columns.forEach((column, index) => {
      obj[column] = (line[index] || "").trim();
    });

    return obj;
  });

  return { columns, rows };
}

function detectHousekeepingColumns(columns) {
  const minuteColumns = findColumns(columns, [
    "temps passe sur la prestation",
    "temps passé sur la prestation",
    "temps passe",
    "temps passé",
    "minutes"
  ]);

  return {
    date:
      exactColumn(columns, "Horodateur") ||
      findColumn(columns, ["horodateur", "date", "timestamp", "jour"]),

    employee:
      exactColumn(columns, "Quel est ton prénom ?") ||
      findColumn(columns, ["prenom", "prénom", "salarié", "salarie", "employé", "employee", "prestataire"]),

    minutes:
      minuteColumns[0] ||
      exactColumn(columns, "Temps passé sur la prestation (minutes)") ||
      findColumn(columns, ["temps passe sur la prestation", "temps passé sur la prestation", "minutes"]),

    minuteColumns,

    purchases:
      exactColumn(columns, "Montant Achats") ||
      findColumn(columns, ["montant achats", "montant achat", "montant"]),

    products:
      findColumn(columns, ["quels produits", "produits achet", "achats effectues", "achats effectués"]),

    receipt:
      exactColumn(columns, "Tickets de caisse") ||
      findColumn(columns, ["tickets de caisse", "ticket de caisse", "fichiers envoyes", "fichiers envoyés", "recu", "reçu"]),

    property:
      exactColumn(columns, "Quel est le logement concerné par ta prestation ?") ||
      findColumn(columns, ["logement concerne", "logement concerné"]),

    surfaces:
      exactColumn(columns, "Quelles sont les surfaces communes que tu as nettoyé ?") ||
      findColumn(columns, ["surfaces communes", "nettoyé", "nettoye"]),

    rooms:
      exactColumn(columns, "Numéro des chambres préparées ?") ||
      findColumn(columns, ["numero des chambres preparees", "numéro des chambres préparées", "chambres preparees", "chambres préparées"]),

    remarks:
      exactColumn(columns, "Remarques") ||
      exactColumn(columns, "Remarques ?") ||
      findColumn(columns, ["remarques", "remarque", "commentaire"]),

    linenPresence:
      exactColumn(columns, "Linge OK ?") ||
      findColumn(columns, ["linge ok", "linge présent", "linge present"]),

    linenCleaned:
      exactColumn(columns, "Combien de paires de draps as-tu nettoyées ?") ||
      findColumn(columns, ["combien de paires", "paires de draps", "nombre de jeux nettoy", "jeux nettoy", "linge nettoy", "lots nettoy", "lot nettoy"]),

    type:
      exactColumn(columns, "Type de prestations") ||
      exactColumn(columns, "Quel type de prestation as-tu réalisé ?") ||
      findColumn(columns, ["type de prestation", "type de prestations", "prestation realise", "prestation réalisé", "mission", "service client", "admin"]),
  };
}

function exactColumn(columns, exactName) {
  return columns.find((column) => normalizeText(column) === normalizeText(exactName));
}

function findColumn(columns, keywords) {
  const normalizedKeywords = keywords.map(normalizeText);
  return columns.find((column) => {
    const normalizedColumn = normalizeText(column);
    return normalizedKeywords.some((keyword) => normalizedColumn.includes(keyword));
  });
}

function findColumns(columns, keywords) {
  const normalizedKeywords = keywords.map(normalizeText);

  return columns.filter((column) => {
    const normalizedColumn = normalizeText(column);
    return normalizedKeywords.some((keyword) => normalizedColumn.includes(keyword));
  });
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getCell(row, column) {
  if (!column) return "";
  return row[column] || "";
}

function getFirstNonEmptyCell(row, columns) {
  const list = Array.isArray(columns) ? columns : [columns];

  for (const column of list) {
    const value = getCell(row, column);
    if (String(value || "").trim()) return value;
  }

  return "";
}

function normalizeEmployeeName(value) {
  const clean = String(value || "").trim();
  if (!clean) return "Non renseigné";
  const lower = normalizeText(clean);

  if (lower.includes("rachida")) return "Rachida";
  if (lower.includes("gaelle") || lower.includes("gaëlle")) return "Gaelle";
  if (lower.includes("jennifer")) return "Jennifer";

  return clean;
}

function normalizePropertyName(value) {
  const clean = String(value || "").trim();
  const lower = normalizeText(clean);

  if (!clean) return "Non renseigné";
  if (lower.includes("fives")) return "Fives";
  if (lower.includes("melezio") || lower.includes("mélézio")) return "Melezio";
  if (lower.includes("wattignies")) return "Wattignies";

  return clean;
}

function normalizeServiceType(value) {
  const clean = String(value || "").trim();
  const lower = normalizeText(clean);

  if (!clean) return "Non renseigné";
  if (lower.includes("service client")) return "Service client";
  if (lower.includes("mission")) return "Service client";
  if (lower.includes("admin")) return "Admin";
  if (lower.includes("linge")) return "Linge";
  if (lower.includes("drap")) return "Linge";
  if (lower.includes("menage") || lower.includes("ménage")) return "Ménage Airbnb";

  return clean;
}

function inferHousekeepingServiceType(row, mapping, employee, property, roomsText, surfaces, remarks, linenCleaned) {
  const explicitType = normalizeServiceType(getCell(row, mapping.type));
  const allText = normalizeText([
    explicitType,
    getCell(row, mapping.type),
    employee,
    property,
    roomsText,
    surfaces,
    remarks
  ].join(" "));

  if (explicitType !== "Non renseigné") return explicitType;

  if (linenCleaned > 0) return "Linge";

  if (
    allText.includes("service client") ||
    allText.includes("mission") ||
    allText.includes("admin")
  ) {
    return "Service client";
  }

  if (
    property !== "Non renseigné" ||
    String(roomsText || "").trim() ||
    String(surfaces || "").trim()
  ) {
    return "Ménage Airbnb";
  }

  if (
    employee !== "Non renseigné" &&
    (
      allText.includes("linge") ||
      allText.includes("drap") ||
      allText.includes("parure") ||
      allText.includes("lits changer")
    )
  ) {
    return "Linge / ménage à vérifier";
  }

  return "Non renseigné";
}

function isAdminService(type, remarks, products) {
  const t = normalizeText(`${type} ${remarks} ${products}`);
  return t.includes("admin") || t.includes("service client") || t.includes("mission");
}

function parseFrenchNumber(value) {
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace("€", "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function parseAnyDate(value) {
  if (!value) return null;
  const raw = String(value).trim();

  const frenchMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (frenchMatch) {
    const day = frenchMatch[1].padStart(2, "0");
    const month = frenchMatch[2].padStart(2, "0");
    let year = frenchMatch[3];
    if (year.length === 2) year = "20" + year;
    return new Date(`${year}-${month}-${day}T12:00:00`);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function countRooms(text) {
  if (!text) return 0;
  const matches = String(text).match(/chambre\s*\d+/gi);
  if (!matches) return 0;

  return unique(matches.map((room) => normalizeText(room).replace(/\s+/g, " "))).length;
}

function detectAnomaly(text) {
  const t = normalizeText(text);
  if (!t.trim()) return false;
  if (["ras", "r.a.s"].includes(t.trim())) return false;

  return [
    "non defait",
    "non défait",
    "pas d'electricite",
    "pas d’électricité",
    "hs",
    "tache",
    "tachée",
    "tachee",
    "client",
    "resali",
    "trace",
    "noire",
    "manque",
    "casse",
    "sale",
    "probleme",
    "problème",
  ].some((word) => t.includes(normalizeText(word)));
}

function groupSummaryHousekeeping(rows, key, hourlyRate, linenRate) {
  const map = {};

  rows.forEach((row) => {
    const name = row[key] || "Non renseigné";

    if (!map[name]) {
      map[name] = {
        name,
        count: 0,
        minutes: 0,
        hours: 0,
        purchases: 0,
        rooms: 0,
        linenCleaned: 0,
        linenPay: 0,
        laborEstimate: 0,
      };
    }

    map[name].count += 1;
    map[name].minutes += row.minutes || 0;
    map[name].hours += row.hours || 0;
    map[name].purchases += row.purchases || 0;
    map[name].rooms += row.roomCount || 0;
    map[name].linenCleaned += row.linenCleaned || 0;
    map[name].linenPay = map[name].linenCleaned * linenRate;
    map[name].laborEstimate = map[name].hours * hourlyRate;
  });

  return Object.values(map).sort((a, b) => b.count - a.count);
}

function groupProducts(rows) {
  const map = {};

  rows.forEach((row) => {
    if (!row.products && !row.purchases) return;

    const rawProducts = String(row.products || "Achat non détaillé")
      .split(/[,;/\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    const products = rawProducts.length ? rawProducts : ["Achat non détaillé"];

    products.forEach((product) => {
      const name = product || "Achat non détaillé";

      if (!map[name]) {
        map[name] = {
          name,
          count: 0,
          amount: 0,
        };
      }

      map[name].count += 1;
      map[name].amount += row.purchases || 0;
    });
  });

  return Object.values(map).sort((a, b) => b.amount - a.amount);
}

function analyzeIdeas(text) {
  const chunks = text
    .split(/[\n.;!?]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 8);

  const source = chunks.length ? chunks : [text.trim()];
  const today = new Date().toISOString().slice(0, 10);

  return source.map((chunk) => ({
    title: makeTitle(chunk),
    description: chunk,
    category: detectCategory(chunk),
    priority: detectPriority(chunk),
    status: "a_traiter",
    done: false,
    week_label: getWeekLabel(today),
  }));
}

function detectCategory(text) {
  const t = text.toLowerCase();
  const n = normalizeText(text);

  if (has(n, [
    "impot",
    "impots",
    "declaration",
    "declarer",
    "fiscal",
    "fiscale",
    "taxe",
    "taxes",
    "comptable",
    "don",
    "succession",
    "notaire",
    "justificatif",
    "administratif",
    "urssaf",
    "tva",
    "banque",
    "releve",
    "relevé",
    "syndic",
    "appel de fonds"
  ])) return "Admin";

  if (has(t, ["uzy", "yuzi", "zephyr", "zéphyr", "bali", "chaton", "mise bas", "vétérinaire", "litière"])) return "Chatterie";
  if (has(t, ["chien", "chat", "poulailler", "poussin", "coq", "poule", "adela", "nadine"])) return "Animaux";
  if (has(t, ["airbnb", "ménage", "lit", "client", "arrivée", "départ", "gaël", "jennifer"])) return "Airbnb";
  if (has(t, ["bananier", "plante", "pot", "mur végétal", "palmier", "olivier"])) return "Plantes";
  if (has(t, ["lyon", "annecy", "ter", "tgv", "ouigo", "vacances", "cousine"])) return "Vacances";
  if (has(t, ["ritaline", "novvasy", "addictologue", "médecin", "santé"])) return "Santé";
  if (has(t, ["papa", "papy", "papi", "restaurant", "collègue"])) return "Perso";
  if (has(t, ["site", "internet", "le bon coin", "vente", "business", "table", "housse"])) return "Business";
  if (has(t, ["maison", "chambre", "lave-vaisselle", "jacuzzi", "aquarium", "escaliers"])) return "Maison";

  return "Plus tard";
}

function detectPriority(text) {
  const t = text.toLowerCase();

  if (has(t, ["urgent", "demain", "aujourd’hui", "aujourd'hui", "avant", "mise bas", "vétérinaire", "arrivée", "départ", "réserver"])) return "haute";
  if (has(t, ["il faut", "je dois", "à faire", "penser", "relancer", "appeler"])) return "moyenne";

  return "basse";
}

function makeTitle(text) {
  const t = text.trim();

  if (/poule|poulailler/i.test(t))
    return "Améliorer l espace des poules";

  if (/bananier/i.test(t))
    return "Développer le stock de bananiers";

  if (/comptable|tva/i.test(t))
    return "Contacter le comptable";

  if (/lyon/i.test(t))
    return "Préparer le déplacement à Lyon";

  return t.charAt(0).toUpperCase() + t.slice(1);
}

function has(text, words) {
  return words.some((word) => text.includes(word));
}

function groupByWeek(ideas) {
  return ideas.reduce((groups, idea) => {
    const week = idea.week_label || getWeekLabel(idea.created_at?.slice(0, 10));
    if (!groups[week]) groups[week] = [];
    groups[week].push(idea);
    return groups;
  }, {});
}

function getWeekLabel(date) {
  const d = new Date((date || new Date().toISOString().slice(0, 10)) + "T12:00:00");
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return `Semaine du ${monday.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} au ${sunday.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`;
}

function formatDate(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("fr-FR");
}

function formatDateOnly(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR");
}

function shortDate(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatNumber(value) {
  const number = Number(value) || 0;
  return number.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function formatCurrency(value) {
  const number = Number(value) || 0;
  return number.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}

function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

const styles = `
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f7f4ef;
  color: #1e1e1e;
}

button, input, select, textarea { font: inherit; }
button { border: 0; cursor: pointer; }

.app {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(143, 175, 154, 0.35), transparent 35%),
    linear-gradient(135deg, #f7f4ef 0%, #efe7da 100%);
}

.loginApp {
  display: grid;
  place-items: center;
  padding: 20px;
}

.loginCard {
  width: min(460px, 100%);
  background: white;
  border-radius: 26px;
  padding: 26px;
  box-shadow: 0 20px 60px rgba(31,77,58,.14);
}

.brandCircle {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  background: #1f4d3a;
  color: white;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 25px;
  margin-bottom: 14px;
}

.loginCard h1 {
  margin: 0;
  color: #1f4d3a;
}

.loginCard p {
  color: #6d6257;
}

.stickyTop {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(31, 77, 58, 0.96);
  box-shadow: 0 12px 30px rgba(31, 77, 58, 0.12);
}

.topHeader {
  color: white;
  padding: 10px 14px 6px;
  display: grid;
  grid-template-columns: 34px 1fr auto;
  gap: 10px;
  align-items: center;
}

.brandMark {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: #d8c7aa;
  color: #1f4d3a;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 900;
}

.topHeader h1 {
  margin: 0;
  font-size: 19px;
}

.topHeader p {
  margin: 1px 0 0;
  color: rgba(255,255,255,.72);
  font-size: 11px;
}

.logoutSmall {
  background: rgba(255,255,255,.14);
  color: white;
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 800;
}

.topNav {
  width: 100%;
  display: flex;
  gap: 4px;
  padding: 5px 6px 8px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.topNav button {
  flex: 0 0 68px;
  border-radius: 15px;
  background: transparent;
  color: rgba(255,255,255,.68);
  padding: 7px 3px;
  display: grid;
  gap: 1px;
  place-items: center;
  scroll-snap-align: start;
}

.topNav button span { font-size: 18px; }
.topNav button small { font-size: 9px; }

.topNav button.active {
  background: rgba(255,255,255,.16);
  color: white;
}

.topNav button.operationalTab {
  color: #f0f4c3;
}

.topNav button.operationalTab.active {
  color: #173f32;
  background: #dce989;
}

.content {
  width: min(980px, 100%);
  margin: 0 auto;
  padding: 14px;
}

@media (display-mode: standalone) {
  .stickyTop {
    padding-top: env(safe-area-inset-top);
  }

  .content {
    padding-bottom: calc(18px + env(safe-area-inset-bottom));
  }
}

.page {
  display: grid;
  gap: 14px;
}

.hero, .card, .miniCard, .progressCard {
  background: rgba(255,255,255,.84);
  border: 1px solid rgba(31,77,58,.09);
  border-radius: 24px;
  padding: 16px;
  box-shadow: 0 16px 40px rgba(31,77,58,.08);
}

.hero {
  background: rgba(255,255,255,.72);
}

.eyebrow {
  margin: 0 0 8px;
  color: #8a6a4f;
  text-transform: uppercase;
  letter-spacing: .13em;
  font-size: 11px;
  font-weight: 900;
}

h2 {
  margin: 0;
  color: #1f4d3a;
  font-size: 31px;
  line-height: 1.05;
}

h3 {
  margin: 0 0 12px;
  color: #1f4d3a;
  font-size: 21px;
}

.hero p, .muted {
  color: #6d6257;
  line-height: 1.55;
}

.smallText {
  color: #6d6257;
  font-size: 13px;
  margin: 8px 0 0;
  line-height: 1.4;
}

label {
  display: grid;
  gap: 8px;
  margin: 14px 0;
  color: #1f4d3a;
  font-weight: 800;
}

input, textarea, select {
  width: 100%;
  border: 1px solid rgba(31,77,58,.16);
  border-radius: 16px;
  padding: 13px 14px;
  background: white;
  color: #1e1e1e;
}

textarea {
  min-height: 90px;
  resize: vertical;
}

.ideaForm textarea {
  min-height: 180px;
}

.primary, .secondaryButton, .dangerButton {
  border-radius: 16px;
  padding: 14px 16px;
  font-weight: 900;
}

.primary {
  background: #1f4d3a;
  color: white;
}

.secondaryButton {
  background: #f7f4ef;
  color: #1f4d3a;
}

.dangerButton {
  background: #fde8e8;
  color: #9f1d1d;
}

.fullWidth {
  width: 100%;
}

.topMessage, .message {
  background: rgba(255,255,255,.84);
  border-radius: 18px;
  padding: 12px 14px;
  color: #1f4d3a;
  font-weight: 800;
  box-shadow: 0 12px 30px rgba(31,77,58,.08);
}

.dashGrid, .statsRow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.statBig, .statCard {
  background: rgba(255,255,255,.84);
  border-radius: 22px;
  padding: 16px;
  box-shadow: 0 16px 40px rgba(31,77,58,.07);
}

.statBig span, .statCard span {
  display: block;
  color: #8a6a4f;
  font-size: 13px;
  margin-bottom: 6px;
}

.statBig strong, .statCard strong {
  color: #1f4d3a;
  font-size: 26px;
}

.statButton {
  text-align: left;
  border: 0;
}

.searchHeroButton {
  background: #1f4d3a;
  color: white;
  border-radius: 22px;
  padding: 18px;
  font-weight: 900;
  font-size: 16px;
  box-shadow: 0 16px 40px rgba(31,77,58,.14);
}

.searchList, .taskList, .history, .ideaList, .summaryList {
  display: grid;
  gap: 10px;
}

.searchItem, .summaryItem {
  background: #f7f4ef;
  border-radius: 18px;
  padding: 13px;
}

.searchItem strong, .summaryItem strong {
  color: #1f4d3a;
  display: block;
}

.searchItem p, .summaryItem span {
  margin: 8px 0 0;
  color: #6d6257;
  line-height: 1.45;
  font-size: 14px;
  display: block;
}

.summaryItem a {
  display: inline-block;
  margin-top: 8px;
  color: #1f4d3a;
  font-weight: 900;
}

.progressBar {
  height: 12px;
  background: #f7f4ef;
  border-radius: 999px;
  overflow: hidden;
  margin-top: 12px;
}

.progressBar span {
  height: 100%;
  display: block;
  background: #1f4d3a;
  border-radius: 999px;
}

.filterBar, .animalSelector {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 3px;
}

.filterBar button, .animalSelector button {
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(255,255,255,.82);
  color: #1f4d3a;
  padding: 10px 13px;
  font-weight: 800;
  border: 1px solid rgba(31,77,58,.08);
}

.filterBar button.selectedFilter, .animalSelector button.selected {
  background: #1f4d3a;
  color: white;
}

.taskItem, .ideaItem {
  background: rgba(255,255,255,.86);
  border-radius: 22px;
  padding: 14px;
  box-shadow: 0 14px 34px rgba(31,77,58,.07);
}

.taskItem {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 12px;
}

.ideaTop {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 12px;
}

.taskItem.done, .ideaItem.done {
  opacity: .58;
}

.taskItem.done strong, .ideaItem.done strong {
  text-decoration: line-through;
}

.checkButton {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: #f7f4ef;
  color: #1f4d3a;
  font-weight: 900;
  font-size: 20px;
}

.taskMeta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.taskMeta span {
  background: #f7f4ef;
  border-radius: 999px;
  padding: 5px 8px;
  font-size: 11px;
  color: #6d6257;
  font-weight: 800;
}

.priority.haute { color: #9f1d1d; }
.priority.moyenne { color: #8a5b00; }
.priority.basse { color: #1f4d3a; }

.deleteTiny {
  margin-top: 10px;
  background: #fde8e8;
  color: #9f1d1d;
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 800;
}

.ideaItem p {
  color: #6d6257;
  margin: 8px 0 0;
  line-height: 1.45;
}

.ideaActions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.ideaActions button, .textButton {
  color: #1f4d3a;
  background: #f7f4ef;
  border-radius: 999px;
  padding: 9px 12px;
  font-weight: 800;
}

.animalCard {
  display: flex;
  gap: 14px;
  align-items: center;
}

.animalEmoji {
  width: 60px;
  height: 60px;
  border-radius: 20px;
  background: #d8c7aa;
  display: grid;
  place-items: center;
  font-size: 32px;
  flex: 0 0 auto;
}

.formCard {
  border: 2px solid rgba(31,77,58,.12);
}

.cardTitleRow {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.ok { color: #1f7a4d !important; }
.danger { color: #b3261e !important; }

.chart {
  color: #1f4d3a;
}

.chart svg {
  width: 100%;
  height: 190px;
  background: #f7f4ef;
  border-radius: 20px;
  padding: 10px;
}

.chartLabels {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin-top: 10px;
}

.chartLabels span {
  flex: 0 0 auto;
  background: #f7f4ef;
  color: #6d6257;
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 13px;
}

.historyItem {
  background: #f7f4ef;
  border-radius: 18px;
  padding: 13px;
  display: grid;
  gap: 8px;
}

.historyItem strong, .historyItem span {
  display: block;
}

.historyItem span, .historyRight span {
  color: #6d6257;
  font-size: 13px;
}

.buttonRow {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.alignBottom {
  align-items: end;
}

.housekeepingDashboard {
  display: grid;
  gap: 14px;
}

.filtersPanel {
  display: grid;
  gap: 12px;
  background: #f7f4ef;
  border-radius: 20px;
  padding: 14px;
}

.wideFilter {
  grid-column: 1 / -1;
}

.kpiGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.kpiCard {
  background: #f7f4ef;
  border-radius: 20px;
  padding: 14px;
}

.kpiCard span {
  font-size: 24px;
}

.kpiCard p {
  color: #8a6a4f;
  margin: 8px 0 4px;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.kpiCard strong {
  color: #1f4d3a;
  font-size: 22px;
}

.dashboardSplit {
  display: grid;
  gap: 12px;
}

.miniDashboard {
  background: #f7f4ef;
  border-radius: 20px;
  padding: 14px;
}

.alertItem {
  background: #fff4e6;
}

.purchaseList {
  margin-top: 12px;
}

.tableWrap {
  overflow-x: auto;
  background: #f7f4ef;
  border-radius: 20px;
  padding: 14px;
}

.dataTable {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.dataTable th, .dataTable td {
  text-align: left;
  padding: 10px;
  border-bottom: 1px solid rgba(31,77,58,.12);
  white-space: nowrap;
  vertical-align: top;
}

.dataTable th {
  color: #1f4d3a;
  font-weight: 900;
}

.detectedColumns {
  background: #f7f4ef;
  border-radius: 20px;
  padding: 14px;
}

.fileButton {
  margin: 0;
  display: inline-grid;
  place-items: center;
  background: #1f4d3a;
  color: white;
  border-radius: 16px;
  padding: 14px 16px;
  font-weight: 900;
  min-width: 130px;
  text-align: center;
}

.fileButton input {
  display: none;
}

@media (min-width: 900px) {
  .topHeader {
    max-width: 980px;
    margin: 0 auto;
  }

  .topNav {
    max-width: 980px;
    margin: 0 auto;
    border-radius: 0 0 24px 24px;
  }

  .content {
    padding: 26px;
  }

  .page {
    gap: 20px;
  }

  .hero, .card, .progressCard {
    padding: 26px;
  }

  .historyItem {
    grid-template-columns: 180px 1fr;
    align-items: center;
  }

  .chart svg {
    height: 260px;
  }

  .filtersPanel {
    grid-template-columns: repeat(3, 1fr);
  }

  .kpiGrid {
    grid-template-columns: repeat(4, 1fr);
  }

  .dashboardSplit {
    grid-template-columns: 1fr 1fr;
  }
}
`;
