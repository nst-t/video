import React from "react";
import Camera from "./Camera";
import "./index.css";

import { createRoot } from "react-dom/client";
const container = document.getElementById("app-root");
const root = createRoot(container!);
root.render(<Camera />);
