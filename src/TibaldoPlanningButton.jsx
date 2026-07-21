export default function TibaldoPlanningButton() {
  const isHome = typeof window !== "undefined" && window.location.pathname === "/";
  if (!isHome) return null;

  return (
    <>
      <button
        className="planningFloatingButton"
        onClick={() => {
          window.location.href = "/planning";
        }}
      >
        <span>📅</span>
        <strong>Planning</strong>
      </button>

      <style>{styles}</style>
    </>
  );
}

const styles = `
.planningFloatingButton {
  position: fixed;
  right: 18px;
  bottom: 146px;
  z-index: 9997;
  border: 0;
  border-radius: 999px;
  padding: 12px 16px;
  background: #2f5f8f;
  color: white;
  box-shadow: 0 18px 40px rgba(31,77,58,.24);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 950;
  cursor: pointer;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.planningFloatingButton span {
  font-size: 22px;
}

@media (max-width: 760px) {
  .planningFloatingButton {
    right: 14px;
    bottom: 146px;
  }
}
`;
