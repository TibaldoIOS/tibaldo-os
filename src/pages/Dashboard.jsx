export default function Dashboard() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#0b0f14",
        color: "#fff",
      }}
    >
      {/* SIDEBAR */}
      <aside
        style={{
          width: "260px",
          background: "#0f1720",
          borderRight: "1px solid rgba(255,255,255,.08)",
          padding: "24px",
        }}
      >
        <h2 style={{ marginBottom: "30px" }}>⚡ TibaldoOS</h2>

        <div style={{ display: "grid", gap: "12px" }}>
          <button>🏠 Dashboard</button>
          <button>💰 Finances</button>
          <button>🏡 Airbnb</button>
          <button>🧠 Carte mentale</button>
          <button>📄 Documents</button>
          <button>🐾 Animaux</button>
          <button>⚙️ Paramètres</button>
        </div>
      </aside>

      {/* CONTENU */}
      <main
        style={{
          flex: 1,
          padding: "40px",
        }}
      >
        <h1
          style={{
            fontSize: "52px",
            marginBottom: "10px",
          }}
        >
          Bonjour Romain 👋
        </h1>

        <p
          style={{
            color: "#94a3b8",
            marginBottom: "40px",
          }}
        >
          Vue d'ensemble TibaldoOS
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
            gap: "20px",
          }}
        >
          {[
            ["💰 Trésorerie", "8 425 €"],
            ["🏡 Airbnb", "5 842 €"],
            ["📄 Documents", "324"],
            ["🐾 Animaux", "3"],
          ].map(([title, value]) => (
            <div
              key={title}
              style={{
                background: "#131c28",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: "24px",
                padding: "24px",
              }}
            >
              <div style={{ color: "#94a3b8" }}>{title}</div>

              <div
                style={{
                  fontSize: "34px",
                  fontWeight: 700,
                  marginTop: "10px",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "30px",
            background: "#131c28",
            borderRadius: "24px",
            padding: "30px",
            minHeight: "350px",
          }}
        >
          <h2>🧠 Carte mentale Obsidian</h2>

          <p style={{ color: "#94a3b8" }}>
            Graphe interactif TibaldoOS à venir.
          </p>
        </div>
      </main>
    </div>
  );
}
