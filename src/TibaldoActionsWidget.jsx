import { useState } from "react";

export default function TibaldoActionsWidget() {
  const [open, setOpen] = useState(false);

  const isHome = typeof window !== "undefined" && window.location.pathname === "/";
  if (!isHome) return null;

  function openAI() {
    window.dispatchEvent(new Event("openTibaldoAI"));
    setOpen(false);
  }

  function openUpload() {
    window.dispatchEvent(new Event("openTibaldoUpload"));
    setOpen(false);
  }

  function openPlanning() {
    window.location.href = "/planning";
  }

  return (
    <>
      <button className="actionsBubble" onClick={() => setOpen((value) => !value)}>
        <span>⚡</span>
        <strong>Actions</strong>
      </button>

      {open && (
        <div className="actionsPanel">
          <p className="actionsEyebrow">Tibaldo OS</p>
          <h2>Actions rapides</h2>

          <button onClick={openAI}>
            <span>🤖</span>
            <div>
              <strong>Tibaldo IA</strong>
              <small>Questions, synthèses, ménage, Airbnb</small>
            </div>
          </button>

          <button onClick={openUpload}>
            <span>📥</span>
            <div>
              <strong>Déposer document</strong>
              <small>PDF Airbnb, factures, documents</small>
            </div>
          </button>

          <button onClick={openPlanning}>
            <span>📅</span>
            <div>
              <strong>Planning</strong>
              <small>Google Agenda + calendrier privé</small>
            </div>
          </button>
        </div>
      )}

      <style>{styles}</style>
    </>
  );
}

const styles = `
.actionsBubble {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 12000;
  border: 0;
  border-radius: 999px;
  padding: 14px 18px;
  background: linear-gradient(135deg, #1f4d3a, #2f7458);
  color: white;
  box-shadow: 0 18px 44px rgba(31,77,58,.32);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 950;
  cursor: pointer;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.actionsBubble span {
  font-size: 22px;
}

.actionsPanel {
  position: fixed;
  right: 14px;
  bottom: 78px;
  z-index: 12000;
  width: min(360px, calc(100vw - 28px));
  background: rgba(255,255,255,.97);
  border: 1px solid rgba(31,77,58,.12);
  border-radius: 28px;
  padding: 16px;
  box-shadow: 0 24px 70px rgba(31,77,58,.24);
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.actionsEyebrow {
  margin: 0 0 6px;
  color: #8a6a4f;
  text-transform: uppercase;
  letter-spacing: .13em;
  font-size: 11px;
  font-weight: 950;
}

.actionsPanel h2 {
  margin: 0 0 12px;
  color: #1f4d3a;
  font-size: 26px;
}

.actionsPanel button {
  width: 100%;
  border: 0;
  border-radius: 20px;
  padding: 14px;
  margin-top: 10px;
  background: #f7f4ef;
  color: #1f4d3a;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  cursor: pointer;
}

.actionsPanel button span {
  font-size: 28px;
}

.actionsPanel button strong {
  display: block;
  font-size: 16px;
  font-weight: 950;
}

.actionsPanel button small {
  display: block;
  margin-top: 3px;
  color: #6d6257;
  font-size: 12px;
  line-height: 1.25;
}
`;
