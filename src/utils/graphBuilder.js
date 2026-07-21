export function buildGraph(nodes) {
  const graphNodes = [];
  const graphEdges = [];

  const categories = {};

  nodes.forEach((node) => {
    const category = node.category || "Divers";

    if (!categories[category]) {
      categories[category] = {
        id: "cat-" + category,
        title: category,
        type: "category",
      };

      graphNodes.push(categories[category]);
    }

    graphNodes.push(node);

    graphEdges.push({
      id: categories[category].id + "-" + node.id,
      source: categories[category].id,
      target: node.id,
    });

    if (node.parent_id) {
      graphEdges.push({
        id: node.parent_id + "-" + node.id,
        source: node.parent_id,
        target: node.id,
      });
    }
  });

  return {
    nodes: graphNodes,
    edges: graphEdges,
  };
}
