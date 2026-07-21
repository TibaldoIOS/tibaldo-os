import ReactFlow, {
  Background,
  Controls,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";

import { updateNodePosition } from "../../services/universeService";

export default function UniverseCanvas({
  nodes = [],
  edges = [],
  onNodeClick,
}) {

  async function handleDragStop(event, node) {
    try {
      await updateNodePosition(
        node.id,
        node.position.x,
        node.position.y
      );
      console.log("Position sauvegardée");
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable
        onNodeClick={onNodeClick}
        onNodeDragStop={handleDragStop}
      >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  );
}
