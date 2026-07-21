import React, { useState } from "react";

export default function SearchPage({ weights, tasks, ideas, onGoPlan, onGoIdeas, onGoChatterie }) {
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

