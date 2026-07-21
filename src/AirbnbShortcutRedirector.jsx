import { useEffect } from "react";

export default function AirbnbShortcutRedirector() {
  useEffect(() => {
    function handleClick(event) {
      if (window.location.pathname !== "/") return;

      const target = event.target.closest("button, a, [role='button']");
      if (!target) return;

      const text = (target.textContent || "").trim().toLowerCase();

      const isAirbnbMenuButton =
        text.includes("airbnb") &&
        text.length < 40;

      if (!isAirbnbMenuButton) return;

      event.preventDefault();
      event.stopPropagation();

      window.location.href = "/airbnb-reporting";
    }

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}
