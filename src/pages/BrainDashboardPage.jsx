import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function BrainDashboardPage() {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    loadNodes();
  }, []);

  async function loadNodes() {
    const { data } = await supabase
      .from("brain_nodes")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setNodes(data);
  }

  const projects = nodes.filter(n => n.node_type === "project");
  const ideas = nodes.filter(n => n.node_type === "idea");
  const tasks = nodes.filter(n => n.node_type === "task");

  const topProjects = [...projects]
    .sort((a,b) => (b.score || 0) - (a.score || 0))
    .slice(0,5);

  return (
    <div className="page">
      <h2>🧠 Brain Dashboard</h2>

      <div className="dashGrid">

        <div className="card">
          <h3>💡 Idées</h3>
          <strong>{ideas.length}</strong>
        </div>

        <div className="card">
          <h3>🚀 Projets</h3>
          <strong>{projects.length}</strong>
        </div>

        <div className="card">
          <h3>✅ Tâches</h3>
          <strong>{tasks.length}</strong>
        </div>

        <div className="card">
          <h3>🧠 Total</h3>
          <strong>{nodes.length}</strong>
        </div>

      </div>

      <div className="card" style={{marginTop:20}}>
        <h3>🔥 Projets prioritaires</h3>

        {topProjects.length === 0 && (
          <p>Aucun projet pour le moment.</p>
        )}

        {topProjects.map(project => (
          <div
            key={project.id}
            style={{
              padding:"12px 0",
              borderBottom:"1px solid rgba(255,255,255,.08)"
            }}
          >
            <strong>{project.title}</strong>

            <div>
              Score : {project.score || 0}/10
            </div>

            <div>
              Action : {project.next_action || "Non définie"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
