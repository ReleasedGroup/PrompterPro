import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { appBrand, appVariant } from "./lib/appBrand";
import "./styles.css";

document.documentElement.dataset.appVariant = appVariant;
document.title = appBrand.name;
document
  .querySelector<HTMLLinkElement>('link[rel="icon"]')
  ?.setAttribute("href", appBrand.icon);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
