import { useEffect, useState } from "react";
import { getNodes } from "../services/universeService";

export default function useUniverse() {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    loadNodes();
  }, []);

  async function loadNodes() {
    try {
      const data = await getNodes();
      setNodes(data);
    } catch (e) {
      console.error(e);
    }
  }

  return {
    nodes,
    reload: loadNodes,
  };
}