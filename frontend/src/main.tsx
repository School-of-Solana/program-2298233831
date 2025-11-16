import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

const g = globalThis as any;
if (!g.global) g.global = g;
if (!g.process) g.process = { env: {} };
// Ensure Buffer exists for libs that rely on it (e.g., web3/Anchor in browser)
import { Buffer } from "buffer";
if (!g.Buffer) g.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


