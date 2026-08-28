import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (
  "serviceWorker" in navigator
  && import.meta.env.PROD
  && import.meta.env.VITE_APP_INTEGRATION_BETA !== "true"
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
