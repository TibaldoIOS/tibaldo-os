import { useMemo } from "react";
import UniverseCanvas from "../components/universe/UniverseCanvas";
import useUniverse from "../hooks/useUniverse";
import { buildGraph } from "../utils/graphBuilder";
import { createNodeQuick } from "../services/universeService";

export default function UniverseReactFlow() {

  const { nodes, reload } = useUniverse();

  const graph = useMemo(() => {

    const g = buildGraph(nodes);

    return {
      nodes: g.nodes.map((n) => ({
        id: String(n.id),
        position: {
          x: n.x ?? Math.random() * 900,
          y: n.y ?? Math.random() * 700,
        },
        data: {
          label: n.title ?? n.label ?? "Sans titre",
        },
      })),
      edges: g.edges.map((e) => ({
        id: String(e.id),
        source: String(e.source),
        target: String(e.target),
      })),
    };

  }, [nodes]);

  async function handleAddNode() {
    try {
      await createNodeQuick();
      await reload();
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  }

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>

      <button
        onClick={handleAddNode}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 9999,
          padding: "12px 18px",
          borderRadius: 12,
          border: "none",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ➕ Nouvelle bulle
      </button>

      <UniverseCanvas
        nodes={graph.nodes}
        edges={graph.edges}
      />

    </div>
  );
}
