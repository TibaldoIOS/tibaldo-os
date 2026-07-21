import { useState } from "react";

function formatDateOnly(date) {
  return new Date(date).toLocaleDateString("fr-FR");
}

function groupByWeek(ideas) {
  return ideas.reduce((groups, idea) => {
    const label = idea.week_label || "Sans semaine";
    if (!groups[label]) groups[label] = [];
    groups[label].push(idea);
    return groups;
  }, {});
}

export default function IdeasPage({
  ideas,
  onAddIdeasFromText,
  onToggleIdea,
  onDeleteIdea,
  onSendIdeaToTask,
}) {
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("Toutes");

  const categories = [
    "Toutes",
    "Chatterie",
    "Animaux",
    "Airbnb",
    "Admin",
    "Maison",
    "Plantes",
    "Business",
    "Vacances",
    "Perso",
    "Santé",
    "Plus tard",
  ];

  const filteredIdeas = ideas.filter(
    (idea) => filter === "Toutes" || idea.category === filter
  );

  const grouped = groupByWeek(filteredIdeas);

  async function submit(event) {
    event.preventDefault();

    if (!text.trim()) {
      return alert("Colle une idée ou un dictaphone transcrit.");
    }

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

        <button className="primary fullWidth" type="submit">
          Analyser et classer
        </button>
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
                <div
                  className={idea.done ? "ideaItem done" : "ideaItem"}
                  key={idea.id}
                >
                  <div className="ideaTop">
                    <button
                      className="checkButton"
                      onClick={() => onToggleIdea(idea)}
                    >
                      {idea.done ? "✓" : ""}
                    </button>

                    <div>
                      <div className="taskMeta">
                        <span>{idea.category}</span>
                        <span className={`priority ${idea.priority}`}>
                          {idea.priority}
                        </span>
                        <span>{formatDateOnly(idea.created_at)}</span>
                      </div>

                      <strong>{idea.title}</strong>
                      <p>{idea.description}</p>

                      <div className="ideaActions">
                        <button onClick={() => onSendIdeaToTask(idea)}>
                          → Plan
                        </button>

                        <button onClick={() => onDeleteIdea(idea.id)}>
                          Supprimer
                        </button>
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