import { useEffect, useState } from "react";
import { universeData } from "../data/universeData";
import useUniverse from "../hooks/useUniverse";

const nodes = [
  { id: "airbnb", emoji: "🏡", label: "Airbnb", x: 25, y: 30 },
  { id: "plantes", emoji: "🌴", label: "Plantes", x: 75, y: 30 },

  { id: "idees", emoji: "💡", label: "Idées", x: 50, y: 28 },

  { id: "voyages", emoji: "✈️", label: "Voyages", x: 10, y: 50 },
  { id: "bengals", emoji: "🐾", label: "Bengals", x: 50, y: 52 },
  { id: "sante", emoji: "❤️", label: "Santé", x: 90, y: 50 },

  { id: "petsitting", emoji: "🐶", label: "Pet-sitting", x: 22, y: 74 },
  { id: "event", emoji: "🎪", label: "Événementiel", x: 78, y: 74 },

  { id: "finances", emoji: "💰", label: "Finances", x: 35, y: 92 },
  { id: "immo", emoji: "🏠", label: "Immobilier", x: 65, y: 92 },

  { id: "admin", emoji: "⚙️", label: "Admin", x: 8, y: 88 },
  { id: "documents", emoji: "📄", label: "Documents", x: 92, y: 88 },
];

const links = [
  ["idees", "bengals"],
  ["idees", "airbnb"],
  ["idees", "plantes"],
  ["bengals", "petsitting"],
  ["airbnb", "finances"],
  ["finances", "immo"],
  ["documents", "admin"],
];

export default function UniversePage() {
  const [selected, setSelected] = useState(null);
  const [tick, setTick] = useState(0);
  const { nodes: dbNodes } = useUniverse();

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((v) => v + 1);
    }, 40);

    return () => clearInterval(timer);
  }, []);

  function mapDbNode(node){
  return {
    id: node.id,
    emoji: "🧠",
    label: node.title,
    x: node.x ?? Math.random()*80+10,
    y: node.y ?? Math.random()*80+10,
  };
}

function getNode(id) {
    return nodes.find((n) => n.id === id);
  }

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

      <div
        style={{
          position: "absolute",
          top: 30,
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 10,
        }}
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
          style={{
            color: "#9fb4d3",
            marginTop: 5,
            fontSize: 16,
            zIndex: 20,
            position: "relative",
          }}
        >
          Second cerveau • Airbnb • Immobilier • Animaux • Plantes
        </div>
      </div>

      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        {links.map(([a, b], index) => {
          const na = getNode(a);
          const nb = getNode(b);

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

      {(dbNodes.length ? dbNodes.map(mapDbNode) : nodes).map((node, index) => {
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
            }}
            style={{
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
            }}
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

      {selected && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            right: 30,
            top: 200,

            width: 320,

            padding: 25,

            borderRadius: 24,

            background: "rgba(10,15,20,.92)",

            backdropFilter: "blur(30px)",

            border: "1px solid rgba(255,255,255,.08)",

            color: "white",
          }}
        >
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
                  <div
                    key={child.title}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      background: "rgba(255,255,255,.08)",
                    }}
                  >
                    {child.emoji} {child.title}
                  </div>
                ))}
              </div>
            )}
          </>

          <button
            onClick={() => setSelected(null)}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
            }}
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}