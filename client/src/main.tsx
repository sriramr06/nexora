import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { restoreSession } from "./lib/api";
import "./index.css";

// Started before the first render (and outside React, so StrictMode cannot run it twice).
void restoreSession();

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
