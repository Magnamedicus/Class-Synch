

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        {/* ✅ Add basename so routing works on GitHub Pages */}
        <BrowserRouter basename="/Class-Synch">
            <App />
        </BrowserRouter>
    </React.StrictMode>
);
