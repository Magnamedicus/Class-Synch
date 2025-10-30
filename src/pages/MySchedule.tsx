import React, { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import Scheduler, { type SchedulerHandle } from "../components/scheduler";
import Modal from "../components/Modal";
import "../css/MySchedule.css";

const MySchedule: React.FC = () => {
    const schedulerRef = useRef<SchedulerHandle>(null);
    const [hasSchedule, setHasSchedule] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveName, setSaveName] = useState("");
    const [savedList, setSavedList] = useState<{ name: string; savedAt: string }[]>([]);
    const [selectedSaved, setSelectedSaved] = useState<string>("");
    // Use a native select for reliable alignment with buttons

    const handleGenerate = () => {
        const schedule = schedulerRef.current?.generate();
        if (schedule) setHasSchedule(true);
        try { localStorage.setItem('scheduleClosed', 'false'); } catch {}
    };

    const handleViewStored = () => {
        try {
            const saved = localStorage.getItem('savedSchedules');
            if (saved) {
                const list: { name: string; savedAt: string; schedule: any }[] = JSON.parse(saved);
                if (Array.isArray(list) && list.length) {
                    const latest = list.reduce((a, b) => (Date.parse(b.savedAt || '') > Date.parse(a.savedAt || '') ? b : a));
                    schedulerRef.current?.load(latest.schedule);
                    setSelectedSaved(latest.name);
                    setHasSchedule(true);
                    try { localStorage.setItem('scheduleClosed', 'false'); } catch {}
                    // Scroll into view so user sees it
                    setTimeout(() => {
                        const el = document.querySelector('.myschedule-grid');
                        if (el && 'scrollIntoView' in el) (el as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 0);
                    return;
                }
            }
            // Fallback to lastSchedule if no named saves yet
            const stored = localStorage.getItem('lastSchedule');
            if (stored) {
                const parsed = JSON.parse(stored);
                schedulerRef.current?.load(parsed);
                setHasSchedule(true);
                try { localStorage.setItem('scheduleClosed', 'false'); } catch {}
            } else {
                alert('No saved schedule found yet. Try Generate Schedule first.');
            }
        } catch (e) {
            console.warn('Failed to load last saved schedule', e);
        }
    };

    // On mount, auto-show saved schedule unless user explicitly closed it
    useEffect(() => {
        try {
            const stored = localStorage.getItem('lastSchedule');
            const closed = localStorage.getItem('scheduleClosed') === 'true';
            if (stored && !closed) setHasSchedule(true);
            const raw = localStorage.getItem('savedSchedules');
            if (raw) {
                const arr = JSON.parse(raw) as any[];
                if (Array.isArray(arr)) {
                    setSavedList(arr.map(x => ({ name: String(x.name), savedAt: String(x.savedAt || "") })));
                }
            }
        } catch {}
    }, []);

    const handleCloseSchedule = () => {
        setHasSchedule(false);
        try { localStorage.setItem('scheduleClosed', 'true'); } catch {}
    };

    const openSaveModal = () => {
        const now = new Date();
        setSaveName(`Schedule ${now.toLocaleString()}`);
        setSaveOpen(true);
    };

    const saveCurrentSchedule = () => {
        try {
            const raw = localStorage.getItem('lastSchedule');
            if (!raw) { alert('No schedule to save. Generate or load one first.'); return; }
            const schedule = JSON.parse(raw);
            const stored = localStorage.getItem('savedSchedules');
            const list: { name: string; savedAt: string; schedule: any }[] = stored ? JSON.parse(stored) : [];
            const now = new Date().toISOString();
            const idx = list.findIndex(x => x.name === saveName);
            if (idx >= 0) {
                list[idx] = { name: saveName, savedAt: now, schedule };
            } else {
                list.push({ name: saveName, savedAt: now, schedule });
            }
            localStorage.setItem('savedSchedules', JSON.stringify(list));
            setSavedList(list.map(({ name, savedAt }) => ({ name, savedAt })));
            setSelectedSaved(saveName);
            setSaveOpen(false);
        } catch (e) {
            console.warn('Failed to save schedule', e);
            alert('Could not save schedule.');
        }
    };

    const loadSavedByName = (name: string) => {
        try {
            const stored = localStorage.getItem('savedSchedules');
            if (!stored) return;
            const list: { name: string; savedAt: string; schedule: any }[] = JSON.parse(stored);
            const entry = list.find(x => x.name === name);
            if (!entry) { alert('Saved schedule not found.'); return; }
            schedulerRef.current?.load(entry.schedule);
            setHasSchedule(true);
            try { localStorage.setItem('scheduleClosed', 'false'); } catch {}
            // ensure the grid is brought into view so the change is obvious
            setTimeout(() => {
                const el = document.querySelector('.myschedule-grid');
                if (el && 'scrollIntoView' in el) (el as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 0);
        } catch (e) {
            console.warn('Failed to load saved schedule', e);
        }
    };

    const deleteSavedByName = (name: string) => {
        try {
            const stored = localStorage.getItem('savedSchedules');
            const list: { name: string; savedAt: string; schedule: any }[] = stored ? JSON.parse(stored) : [];
            const next = list.filter(x => x.name !== name);
            localStorage.setItem('savedSchedules', JSON.stringify(next));
            setSavedList(next.map(({ name, savedAt }) => ({ name, savedAt })));
            if (selectedSaved === name) setSelectedSaved("");
        } catch (e) {
            console.warn('Failed to delete saved schedule', e);
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
                        <div className="toolbar-select">
                            <select
                                className="toolbar-native-select"
                                aria-label="My Schedules"
                                value={selectedSaved}
                                onChange={(e) => {
                                    const name = e.target.value;
                                    setSelectedSaved(name);
                                    if (name) loadSavedByName(name);
                                }}
                            >
                                <option value="">My Schedules…</option>
                                {savedList.map(s => (
                                    <option key={s.name} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                            <button
                                className="btn btn-lg"
                                title="Delete selected"
                                onClick={() => { if (selectedSaved) deleteSavedByName(selectedSaved); }}
                                disabled={!selectedSaved}
                            >
                                Delete
                            </button>
                        </div>
                        {hasSchedule && (
                            <button className="btn danger btn-lg" onClick={handleCloseSchedule}>
                                Close Schedule
                            </button>
                        )}
                    </div>
                </section>

                {/* Scheduler is always mounted so the ref works; hidden until used */}
                <section
                    className={`myschedule-grid glass center-block ${hasSchedule ? "" : "is-hidden"}`}
                    aria-hidden={hasSchedule ? "false" : "true"}
                >
                    <Scheduler ref={schedulerRef} />
                </section>
                {hasSchedule && (
                    <div className="center" style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button className="btn primary btn-lg" onClick={openSaveModal}>Save this schedule</button>
                        <button className="btn btn-lg" onClick={() => schedulerRef.current?.toggleBackpack()}>
                            { /* label toggles based on internal state is okay to keep generic here */ }
                            Open Backpack
                        </button>
                    </div>
                )}

                <Modal isOpen={saveOpen} onClose={() => setSaveOpen(false)}>
                    <h3>Name Your Schedule</h3>
                    <div className="modal-form">
                        <label>
                            Schedule name
                            <input
                                type="text"
                                value={saveName}
                                onChange={(e) => setSaveName(e.target.value)}
                                placeholder="e.g. Finals Week Plan"
                                style={{ padding: '10px', borderRadius: 8, border: '1px solid #334155' }}
                            />
                        </label>
                    </div>
                    <div className="modal-actions">
                        <button onClick={saveCurrentSchedule}>Save</button>
                        <button onClick={() => setSaveOpen(false)}>Cancel</button>
                    </div>
                </Modal>
            </main>
        </div>
    );
};

export default MySchedule;
