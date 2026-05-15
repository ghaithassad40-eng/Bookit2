import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

/**
 * Hide the boot splash (the inline loader in index.html) once React has
 * rendered and the first paint has landed. requestAnimationFrame defers the
 * fade-out until after layout, so users always get to see the brand
 * animation for *at least* one frame even on instant cache loads.
 *
 * Safety net: if for any reason React never mounts (script error, etc.) the
 * 5-second timer below still removes the splash so users aren't trapped on
 * a frozen video. The transition is purely CSS — see .boot-loader styles
 * in index.html.
 */
function hideBootSplash() {
  const el = document.getElementById("boot-loader");
  if (!el) return;
  el.classList.add("is-hidden");
  // Remove from DOM after the CSS fade finishes so it stops costing layout.
  window.setTimeout(() => el.remove(), 500);
}

requestAnimationFrame(() => {
  // Give the first paint a tiny grace period so the splash isn't a 1-frame
  // flash on fast machines — 350ms feels intentional, not stuck.
  window.setTimeout(hideBootSplash, 350);
});

// Safety: if something throws before React mounts, never trap the user.
window.setTimeout(hideBootSplash, 5000);
