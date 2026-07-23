import { useMemo, useState } from "react";
import UniverseCanvas from "../components/universe/UniverseCanvas";
import useUniverse from "../hooks/useUniverse";
import { buildGraph } from "../utils/graphBuilder";
import { createNodeQuick } from "../services/universeService";

export default function UniverseReactFlow() {

  const { nodes, reload } = useUniverse();
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Idées");
  const [saving, setSaving] = useState(false);

  const graph = useMemo(() => {

    const g = buildGraph(nodes);

    return {
      nodes: g.nodes.map((n, index) => ({
        id: String(n.id),
        type: "bubble",
        position: {
          x: n.x ?? 120 + ((index * 239) % 820),
          y: n.y ?? 120 + ((index * 173) % 560),
        },
        data: {
          label: n.title ?? n.label ?? "Sans titre",
          category: n.category || (n.type === "category" ? n.title : "Divers"),
          type: n.type || "idea",
          floatDelay: -(index % 7) * .55,
          original: n,
        },
      })),
      edges: g.edges.map((e) => ({
        id: String(e.id),
        source: String(e.source),
        target: String(e.target),
        animated: true,
        style: { stroke: "rgba(99,190,255,.48)", strokeWidth: 1.5 },
      })),
    };

  }, [nodes]);

  async function handleAddNode(event) {
    event?.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createNodeQuick({ title: title.trim(), category });
      await reload();
      setTitle("");
      setShowCreate(false);
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden" }}>
      <div className="universe-toolbar">
        <button className="universe-add universe-glass" onClick={() => setShowCreate(true)}>＋ Ajouter une idée</button>
        <div className="universe-title universe-glass"><strong>UNIVERS TIBALDO</strong><small>{nodes.length} idées • connexions automatiques</small></div>
      </div>

      <UniverseCanvas
        nodes={graph.nodes}
        edges={graph.edges}
        onNodeClick={(_, node) => setSelected(node.data)}
      />

      {selected && (
        <aside className="universe-panel universe-glass">
          <div style={{ fontSize: 12, opacity: .6, textTransform: "uppercase", letterSpacing: ".12em" }}>{selected.category}</div>
          <h2 style={{ margin: "8px 0" }}>{selected.label}</h2>
          <p style={{ color: "rgba(255,255,255,.68)" }}>Cette bulle est rapprochée automatiquement des idées de la même catégorie et de ses idées parentes.</p>
          <button onClick={() => setSelected(null)}>Fermer</button>
        </aside>
      )}

      {showCreate && (
        <div className="universe-modal-backdrop" onClick={() => setShowCreate(false)}>
          <form className="universe-modal universe-glass" onSubmit={handleAddNode} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Nouvelle idée</h2>
            <label>Titre de l’idée<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex. Acheter une maison à Lille" /></label>
            <label>Univers<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Idées</option><option>Airbnb</option><option>Finances</option><option>Immobilier</option><option>Plantes</option><option>Animaux</option><option>Divers</option></select></label>
            <div className="universe-modal__actions"><button type="button" onClick={() => setShowCreate(false)}>Annuler</button><button type="submit" disabled={saving || !title.trim()}>{saving ? "Création…" : "Créer la bulle"}</button></div>
          </form>
        </div>
      )}

    </div>
  );
}
