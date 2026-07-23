import ReactFlow, {
  Background,
  Controls,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";
import "./universe.css";
import UniverseBubbleNode from "./UniverseBubbleNode";

import { updateNodePosition } from "../../services/universeService";

const nodeTypes = { bubble: UniverseBubbleNode };

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
    <div className="universe-stage" style={{ width: "100%", height: "100vh", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable
        onNodeClick={onNodeClick}
        onNodeDragStop={handleDragStop}
        nodeTypes={nodeTypes}
        minZoom={0.25}
        maxZoom={2.2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(140,190,255,.16)" gap={34} size={1} />
        <MiniMap nodeColor="#3d8fc4" maskColor="rgba(1,7,15,.72)" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
