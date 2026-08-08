import React from "react";
import { createRoot } from "react-dom/client";
import { EaglePrivacyWorkspace } from "./EaglePrivacyWorkspace.jsx";
import "./privacy-workspace.css";

const root = document.getElementById("privacyApp");

if (root) {
  createRoot(root).render(<EaglePrivacyWorkspace host={globalThis.MaxPrivacyHost} />);
}
