import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

try {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
} catch (err) {
  const diag = document.getElementById("boot-diag");
  if (diag) {
    diag.classList.add("on");
    diag.innerHTML =
      "<h1 style='font:700 15px ui-monospace,monospace;letter-spacing:.12em;color:#ffb224;margin:0 0 12px'>ELECTROCARE · MOUNT FAILED</h1>" +
      "<pre style='white-space:pre-wrap;color:#ff9d97;font:13px/1.7 ui-monospace,monospace'>" +
      String((err as Error)?.message ?? err).replace(/</g, "&lt;") +
      "</pre>";
  }
  console.error("ElectroCare mount failed:", err);
}
