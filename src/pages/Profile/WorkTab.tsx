// src/pages/Profile/tabs/WorkTab.tsx
import React from "react";

export default function WorkTab() {
    const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const work = user.work || {};

    return (
        <section className="tab-section">
            <h2>💼 Work</h2>
            {Object.keys(work).length === 0 ? (
                <p>No work preferences found.</p>
            ) : (
                <ul>
                    <li><strong>Priority:</strong> <span>{work.priority}%</span></li>
                    <li><strong>Available Days:</strong> <span>{(work.daysAvailable || []).join(", ")}</span></li>
                    <li><strong>Hours per Day:</strong> <span>{work.hoursPerDay}</span></li>
                    <li><strong>Preferred Shift:</strong> <span>{work.preferredShift}</span></li>
                </ul>
            )}
        </section>
    );
}
