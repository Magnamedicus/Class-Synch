// src/pages/Profile/tabs/SelfCareTab.tsx
import React from "react";

export default function SelfCareTab() {
    const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const selfcare = user.selfcare || {};

    return (
        <section className="tab-section">
            <h2>🧘 Self-Care</h2>
            {Object.keys(selfcare).length === 0 ? (
                <p>No self-care info available.</p>
            ) : (
                <ul>
                    <li><strong>Priority:</strong> <span>{selfcare.priority}%</span></li>
                    <li><strong>Activities:</strong> <span>{(selfcare.activities || []).join(", ")}</span></li>
                    <li><strong>Minimum Time:</strong> <span>{selfcare.minTime}</span></li>
                </ul>
            )}
        </section>
    );
}
