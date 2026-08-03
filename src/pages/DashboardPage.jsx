function formatDate(date) {
  return new Date(date).toLocaleDateString("fr-FR");
}

export default function DashboardPage({
  weights = [],
  tasks = [],
  ideas = [],
  onGoPlan,
  onGoIdeas,
  onGoSearch,
  onGoChatterie,
  onGoAirbnb,
  onGoPlus,
}) {
  const uzyWeights = weights.filter((w) => w.animal_key === "uzy");
  const lastUzy = uzyWeights[uzyWeights.length - 1];

  const openTasks = tasks.filter((t) => !t.done).length;
  const urgentTasks = tasks.filter(
    (t) => !t.done && t.priority === "haute"
  ).length;

  const openIdeas = ideas.filter((i) => !i.done).length;

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Accueil</p>
        <h2>Bonjour Romain</h2>
        <p>
          Tibaldo OS est synchronisé avec Supabase : pesées, tâches,
          idées, recherche globale, Airbnb et tableau de bord ménage.
        </p>
      </div>

      <button
        className="searchHeroButton"
        onClick={onGoSearch}
      >
        🔎 Rechercher dans tout Tibaldo OS
      </button>

      <div className="dashGrid">
        <button
          className="statBig statButton"
          onClick={onGoChatterie}
        >
          <span>Pesées</span>
          <strong>{weights.length}</strong>
        </button>

        <button
          className="statBig statButton"
          onClick={onGoPlan}
        >
          <span>Tâches ouvertes</span>
          <strong>{openTasks}</strong>
        </button>

        <button
          className="statBig statButton"
          onClick={onGoPlan}
        >
          <span>Urgences</span>
          <strong>{urgentTasks}</strong>
        </button>

        <button
          className="statBig statButton"
          onClick={onGoIdeas}
        >
          <span>Idées ouvertes</span>
          <strong>{openIdeas}</strong>
        </button>
      </div>

      <div className="card">
        <p className="eyebrow">Airbnb</p>
        <h3>Recettes & PDF</h3>
        <p className="muted">
          Dépose un rapport PDF Airbnb pour analyser
          les recettes, les frais, les nuits et les logements.
        </p>
        <button
          className="primary"
          onClick={onGoAirbnb}
        >
          Ouvrir Airbnb
        </button>
      </div>

      <div className="card">
        <p className="eyebrow">Ménage</p>
        <h3>Tableau de bord prestations</h3>
        <p className="muted">
          Analyse les heures, achats, linge,
          admin/service client et coûts estimés.
        </p>
        <button
          className="secondaryButton"
          onClick={onGoPlus}
        >
          Ouvrir Plus → Ménage
        </button>
      </div>

      <div className="card">
        <p className="eyebrow">Uzy</p>
        <h3>Dernière pesée</h3>

        <p className="muted">
          {lastUzy
            ? `${lastUzy.weight} kg le ${formatDate(lastUzy.date)}`
            : "Aucune pesée enregistrée."}
        </p>

        <button
          className="secondaryButton"
          onClick={onGoChatterie}
        >
          Ouvrir Chatterie
        </button>
      </div>
    </section>
  );
}
