// src/pages/Profile/tabs/LeisureTab.tsx
import React from "react";

export default function LeisureTab() {
    const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const leisure = user.leisure || {};

    return (
        <section className="tab-section">
            <h2>🎮 Leisure</h2>
            {Object.keys(leisure).length === 0 ? (
                <p>No leisure activities found.</p>
            ) : (
                <ul>
                    <li><strong>Priority:</strong> <span>{leisure.priority}%</span></li>
                    <li><strong>Activities:</strong> <span>{(leisure.activities || []).join(", ")}</span></li>
                    <li><strong>Max Time:</strong> <span>{leisure.maxTime}</span></li>
                </ul>
            )}
        </section>
    );
}
