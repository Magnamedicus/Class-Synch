import React, { useRef, useState } from "react";
import Navbar from "../components/Navbar";
import Scheduler, { type SchedulerHandle } from "../components/scheduler";
import "../css/MySchedule.css";

const MySchedule: React.FC = () => {
    const schedulerRef = useRef<SchedulerHandle>(null);
    const [hasSchedule, setHasSchedule] = useState(false);

    const handleGenerate = () => {
        const schedule = schedulerRef.current?.generate();
        if (schedule) setHasSchedule(true);
    };

    const handleViewStored = () => {
        const stored = localStorage.getItem("lastSchedule");
        if (stored) {
            // Just reveal the card; Scheduler manages its own persisted state.
            setHasSchedule(true);
        } else {
            alert("No saved schedule found yet. Try Generate Schedule first.");
        }
    };

    return (
        <div className="myschedule-bg">
            <div className="myschedule-overlay" />
            <Navbar />

            <main className="myschedule-container">
                <header className="myschedule-hero center">
                    <h1 className="hero-title">My Schedule</h1>
                    <p className="hero-subtitle">
                        Create a balanced week from your profile inputs.
                    </p>
                </header>

                {/* Compact, centered toolbar */}
                <section className="myschedule-toolbar glass toolbar-compact">
                    <div className="toolbar-row">
                        <button className="btn primary btn-lg" onClick={handleGenerate}>
                            Generate Schedule
                        </button>
                        <button className="btn btn-lg" onClick={handleViewStored}>
                            View Last Saved
                        </button>
                    </div>
                </section>

                {/* Scheduler is always mounted so the ref works; hidden until used */}
                <section
                    className={`myschedule-grid glass center-block ${hasSchedule ? "" : "is-hidden"}`}
                    aria-hidden={hasSchedule ? "false" : "true"}
                >
                    <Scheduler ref={schedulerRef} />
                </section>
            </main>
        </div>
    );
};

export default MySchedule;
