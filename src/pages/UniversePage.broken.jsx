import { useEffect, useState } from "react";
import { universeData } from "../data/universeData";
import { brainNodes } from "../data/brainNodes";
import { buildAutoLinks } from "../utils/buildAutoLinks";
import { simplifyIdea } from "../utils/simplifyIdea";
import { supabase } from "../supabaseClient";

const fixedNodes = [];
const links = [];
const buildDisplayNodes = (userNodes) => [
  ...fixedNodes,
  ...userNodes.map((n, i) => ({
    id: n.id,
    emoji: "🧠",
    label: n.title,
    x: 20 + ((i * 17) % 60),
    y: 20 + ((i * 13) % 60),
  })),
];
export default function UniversePage() {
  const [selected, setSelected] = useState(null);
  const [expandedNode, setExpandedNode] = useState(null);
  const [tick, setTick] = useState(0);
  const [userNodes, setUserNodes] = useState([]);
const [brainLinks, setBrainLinks] = useState([]);
const [newIdea, setNewIdea] = useState("");
  const displayNodes = buildDisplayNodes(userNodes);
  useEffect(() => {
    loadNodes();
  }, []);
  async function loadNodes() {
    const { data } = await supabase
      .from("brain_nodes")
      .select("*")
      .order("created_at");
    if (data) {
      setUserNodes(data);
    }
    const { data: linksData } = await supabase
      .from("brain_links")
      .select("*");
    if (linksData) {
      setBrainLinks(
        linksData.map(l => [l.source_id, l.target_id])
      );
  }
const addIdea = async () => {
  const title = simplifyIdea(newIdea.trim());
  if (!title) return;
  const autoConnections = buildAutoLinks(title);
  console.log("🧠 Connexions proposées :", autoConnections);
  const newNode = {
    title,
    description: "",
    tags: [],
    x: 0,
    y: 0,
  };
  const { data, error } = await supabase
    .from("brain_nodes")
    .insert(newNode)
    .select()
    .single();
  console.log("SUPABASE DATA =", data);
  console.log("SUPABASE ERROR =", error);
  if (data) {
    if (autoConnections.length) {
      const linksToInsert = autoConnections.map(target => ({
        source_id: data.id,
        target_id: target
      }));
      await supabase
        .from("brain_links")
        .insert(linksToInsert);
      console.log("🔗 Brain links créés :", linksToInsert);
    setUserNodes((prev) => [...prev, data]);
    setNewIdea("");
};
const handleKeyDown = (e) => {
  if (e.key === "Enter") addIdea();
    const timer = setInterval(() => {
      setTick((v) => v + 1);
    }, 40);
    return () => clearInterval(timer);
  function getNode(id) {
    return displayNodes.find((n) => n.id === id);
  return (
    <div
      onClick={() => setSelected(null)}
      style={{
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        background:
          "radial-gradient(circle at center, #1a2840 0%, #091018 80%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 180,
          background:
            "linear-gradient(to bottom, rgba(5,10,15,.95), rgba(5,10,15,0))",
          zIndex: 5,
        }}
      />
          top: 30,
          textAlign: "center",
          zIndex: 10,
      >
        <h1
          style={{
            color: "white",
            fontSize: 42,
            margin: 0,
            letterSpacing: 2,
            textShadow: "0 0 40px rgba(255,255,255,.35)",
          }}
        >
          TIBALDO OS
        </h1>
        <div
            color: "#9fb4d3",
            marginTop: 5,
            fontSize: 16,
            zIndex: 20,
            position: "relative",
          Second cerveau • Airbnb • Immobilier • Animaux • Plantes
        </div>
            marginTop: 20,
            display: "flex",
            justifyContent: "center",
            gap: 10
          <input
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="💡 Capturer une idée..."
            style={{
              width: 500,
              padding: 12,
              borderRadius: 12,
              border: "none"
            }}
          />
          <button onClick={addIdea}>
            Ajouter
          </button>
      </div>
      <svg
          inset: 0,
          width: "100%",
          height: "100%",
        {[...links, ...brainLinks].map(([a, b], index) => {
          const na = getNode(a);
          const nb = getNode(b);
          if (!na || !nb) return null;
          return (
            <line
              key={index}
              x1={`${na.x}%`}
              y1={`${na.y}%`}
              x2={`${nb.x}%`}
              y2={`${nb.y}%`}
              stroke="rgba(120,180,255,.25)"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      {displayNodes.map((node, index) => {
        const floatX = Math.sin(tick / 50 + index) * 10;
        const floatY = Math.cos(tick / 55 + index) * 10;
        return (
          <div
            key={node.id}
            onClick={(e) => {
              e.stopPropagation();
              setSelected({
                ...node,
                children: universeData[node.id]?.children || [],
              });
              setExpandedNode(node.id);
              position: "absolute",
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: `translate(-50%,-50%) translate(${floatX}px,${floatY}px)`,
              width: 105,
              height: 105,
              borderRadius: "50%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              cursor: "pointer",
              backdropFilter: "blur(25px)",
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.15)",
              boxShadow:
                selected?.id === node.id
                  ? "0 0 60px rgba(80,180,255,.9)"
                  : "0 0 25px rgba(255,255,255,.08)",
              transition: ".3s",
          >
            <div style={{ fontSize: 36 }}>{node.emoji}</div>
            <div
              style={{
                marginTop: 6,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {node.label}
            </div>
          </div>
        );
      })}
      
      {expandedNode &&
        displayNodes
          .filter((n) => n.id === expandedNode)
          .map((parent) => {
            const children =
              universeData[parent.id]?.children || [];
            return children.map((child, index) => {
              const angle =
                (index / children.length) * Math.PI * 2;
              const radius = 140;
              const x =
                parent.x +
                (Math.cos(angle) * radius) / 15;
              const y =
                parent.y +
                (Math.sin(angle) * radius) / 10;
              return (
                <div
                  key={child.title}
                  style={{
                    position: "absolute",
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: "translate(-50%,-50%)",
                    width: 70,
                    height: 70,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,.12)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,.15)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    zIndex: 30,
                  }}
                >
                  <div>{child.emoji}</div>
                  <div
                    style={{
                      fontSize: 10,
                      textAlign: "center",
                      marginTop: 2,
                    }}
                  >
                    {child.title}
                  </div>
                </div>
              );
            });
          })}
{selected && (
          onClick={(e) => e.stopPropagation()}
            position: "fixed",
            right: 30,
            top: 200,
            width: 320,
            padding: 25,
            borderRadius: 24,
            background: "rgba(10,15,20,.92)",
            backdropFilter: "blur(30px)",
            border: "1px solid rgba(255,255,255,.08)",
          <h2 style={{ marginTop: 0 }}>
            {selected.emoji} {selected.label}
          </h2>
          <>
            <p>Module sélectionné.</p>
            {selected.children?.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 20,
                  marginBottom: 20,
                }}
              >
                {selected.children.map((child) => (
                  <button
                    key={child.title}
                    onClick={() => alert(child.title)}
                      padding: "8px 12px",
                      borderRadius: 12,
                      background: "rgba(255,255,255,.08)",
                      color: "white",
                      border: "none",
                      cursor: "pointer",
                    {child.emoji} {child.title}
                  </button>
                ))}
              </div>
            )}
          </>
          <button
            onClick={() => setSelected(null)}
              width: "100%",
              border: "none",
            Fermer
      )}
    
      <button
        onClick={addIdea}
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 64,
          height: 64,
          borderRadius: "50%",
          border: "none",
          fontSize: 32,
          cursor: "pointer",
          background: "#2563eb",
          color: "white",
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
          zIndex: 9999
        +
      </button>
</div>
  );
}
