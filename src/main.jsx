import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import PrivateModulesApp from "./privateModules/PrivateModulesApp";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {import.meta.env.VITE_PRIVATE_MODULES_BETA === "true" ? <PrivateModulesApp /> : <App />}
  </StrictMode>
);

if (
  "serviceWorker" in navigator &&
  import.meta.env.PROD &&
  import.meta.env.VITE_PRIVATE_MODULES_BETA !== "true"
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
