export default function Sidebar({ page, setPage }) {
  const items = [
    ["dashboard", "🏠 Dashboard"],
    ["finances", "💰 Finances"],
    ["airbnb", "🏡 Airbnb"],
    ["documents", "📄 Documents"],
    ["animals", "🐾 Animaux"],
    ["brain", "🧠 Carte mentale"],
  ];

  return (
    <aside
      style={{
        width: "280px",
        background: "#111827",
        padding: "24px",
        borderRight: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <h2>⚡ TibaldoOS</h2>

      <div
        style={{
          marginTop: "30px",
          display: "grid",
          gap: "10px",
        }}
      >
        {items.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            style={{
              opacity: page === id ? 1 : 0.8,
              fontWeight: page === id ? 700 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </aside>
  );
}