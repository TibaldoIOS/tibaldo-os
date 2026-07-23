import { Handle, Position } from "reactflow";

const COLORS = {
  Airbnb: [71, 168, 255],
  Finances: [255, 190, 76],
  Plantes: [76, 210, 137],
  Animaux: [244, 122, 168],
  Idées: [165, 119, 255],
  Immobilier: [255, 132, 92],
  Divers: [112, 194, 255],
};

function colorFor(category) {
  return COLORS[category] || COLORS.Divers;
}

function emojiFor(type, category) {
  if (type === "category") return "✦";
  const emojis = { Airbnb: "🏡", Finances: "💶", Plantes: "🌿", Animaux: "🐾", Idées: "💡", Immobilier: "🏠" };
  return emojis[category] || "💭";
}

export default function UniverseBubbleNode({ data, selected }) {
  const [r, g, b] = colorFor(data.category);
  const isCategory = data.type === "category";
  const size = isCategory ? 132 : 98;

  return (
    <div
      className={`universe-bubble ${isCategory ? "universe-bubble--category" : ""} ${selected ? "is-selected" : ""}`}
      style={{
        "--bubble-rgb": `${r}, ${g}, ${b}`,
        width: size,
        height: size,
        animationDelay: `${data.floatDelay || 0}s`,
      }}
    >
      <Handle type="target" position={Position.Top} className="universe-handle" />
      <div className="universe-bubble__shine" />
      <div className="universe-bubble__emoji">{emojiFor(data.type, data.category)}</div>
      <div className="universe-bubble__label">{data.label}</div>
      {!isCategory && <div className="universe-bubble__category">{data.category}</div>}
      <Handle type="source" position={Position.Bottom} className="universe-handle" />
    </div>
  );
}
