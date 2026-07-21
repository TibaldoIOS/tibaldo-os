import { useMemo, useState } from "react";

function formatDate(date) {
  return new Date(date).toLocaleDateString("fr-FR");
}

export default function PlanPage({
  tasks,
  onToggleTask,
  onAddTask,
  onDeleteTask,
}) {
  const [filter, setFilter] = useState("Tous");
  const [openForm, setOpenForm] = useState(false);

  const categories = [
    "Tous",
    "Chatterie",
    "Airbnb",
    "Animaux",
    "Santé",
    "Perso",
    "Business",
    "Vacances",
    "Admin",
    "Maison",
    "Plantes",
    "Plus tard",
  ];

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(
        (task) => filter === "Tous" || task.category === filter
      )
      .sort(
        (a, b) =>
          new Date(
            `${a.date || "2999-01-01"}T${a.time || "12:00"}`
          ) -
          new Date(
            `${b.date || "2999-01-01"}T${b.time || "12:00"}`
          )
      );
  }, [tasks, filter]);

  const done = tasks.filter((t) => t.done).length;
  const percent = tasks.length
    ? Math.round((done / tasks.length) * 100)
    : 0;

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Plan synchronisé</p>
        <h2>Agenda & tâches</h2>
        <p>
          Les tâches et cases cochées sont stockées dans Supabase.
        </p>
      </div>

      <div className="progressCard">
        <p className="eyebrow">Avancement</p>
        <h3>{percent}% terminé</h3>
        <p className="muted">
          {done} tâche(s) terminée(s) sur {tasks.length}
        </p>

        <div className="progressBar">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      <button
        className="primary fullWidth"
        onClick={() => setOpenForm(!openForm)}
      >
        {openForm
          ? "Fermer le formulaire"
          : "+ Ajouter une tâche"}
      </button>

      {openForm && (
        <TaskForm
          onAddTask={onAddTask}
          onClose={() => setOpenForm(false)}
        />
      )}

      <div className="filterBar">
        {categories.map((category) => (
          <button
            key={category}
            className={
              filter === category
                ? "selectedFilter"
                : ""
            }
            onClick={() => setFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="taskList">
        {filteredTasks.map((task) => (
          <div
            className={
              task.done
                ? "taskItem done"
                : "taskItem"
            }
            key={task.id}
          >
            <button
              className="checkButton"
              onClick={() => onToggleTask(task)}
            >
              {task.done ? "✓" : ""}
            </button>

            <div>
              <div className="taskMeta">
                <span>
                  {task.category ||
                    "Sans catégorie"}
                </span>

                {task.date && (
                  <span>
                    {formatDate(task.date)}
                    {task.time
                      ? ` · ${task.time}`
                      : ""}
                  </span>
                )}

                <span
                  className={`priority ${
                    task.priority || "moyenne"
                  }`}
                >
                  {task.priority || "moyenne"}
                </span>
              </div>

              <strong>{task.title}</strong>

              {task.description && (
                <p className="smallText">
                  {task.description}
                </p>
              )}

              <button
                className="deleteTiny"
                onClick={() =>
                  onDeleteTask(task.id)
                }
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskForm({
  onAddTask,
  onClose,
}) {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState("Plus tard");
  const [priority, setPriority] =
    useState("moyenne");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [description, setDescription] =
    useState("");

  async function submit(event) {
    event.preventDefault();

    if (!title.trim()) {
      return alert(
        "Entre un titre de tâche."
      );
    }

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
      <p className="eyebrow">
        Nouvelle tâche
      </p>

      <h3>Ajouter au plan</h3>

      <label>
        Titre
        <input
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
          placeholder="Ex : appeler papa"
        />
      </label>

      <label>
        Catégorie
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value)
          }
        >
          {[
            "Chatterie",
            "Airbnb",
            "Animaux",
            "Santé",
            "Perso",
            "Business",
            "Vacances",
            "Admin",
            "Maison",
            "Plantes",
            "Plus tard",
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <label>
        Priorité
        <select
          value={priority}
          onChange={(e) =>
            setPriority(e.target.value)
          }
        >
          <option value="haute">
            haute
          </option>
          <option value="moyenne">
            moyenne
          </option>
          <option value="basse">
            basse
          </option>
        </select>
      </label>

      <label>
        Date
        <input
          type="date"
          value={date}
          onChange={(e) =>
            setDate(e.target.value)
          }
        />
      </label>

      <label>
        Heure
        <input
          type="time"
          value={time}
          onChange={(e) =>
            setTime(e.target.value)
          }
        />
      </label>

      <label>
        Description
        <textarea
          value={description}
          onChange={(e) =>
            setDescription(
              e.target.value
            )
          }
        />
      </label>

      <button
        className="primary fullWidth"
        type="submit"
      >
        Enregistrer la tâche
      </button>
    </form>
  );
}