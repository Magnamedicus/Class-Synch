// src/pages/Profile/SchoolTab.tsx
import React from "react";
import QUESTIONS from "../../utils/questions";

import PrioritySlider from "../../components/inputs/PrioritySlider";
import NumberInput from "../../components/inputs/NumberInput";
import TextInput from "../../components/inputs/TextInput";
import EnterClasses from "../../components/inputs/EnterClasses";
import TimeInput from "../../components/inputs/TimeInput";
import DaySelection, { type DayName } from "../../components/inputs/DaySelection";
import TimeOfDaySelection, { type TimeName } from "../../components/inputs/TimeOfDaySelection";

import "../../css/Profile.css";
import "../../css/SchoolTab.css";

/* ---------------- Storage helpers (exactly like QuestionnairePage) ---------------- */
function readJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}
function writeJSON(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(value));
}
function emailKey(email: string) {
    return encodeURIComponent((email || "").trim().toLowerCase());
}
function qaAnswersKey(email: string) {
    return `QA::answers::${emailKey(email)}`;
}

/* Use the same slugify as QuestionnairePage to guarantee identical per-class keys */
function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

type Answers = Record<string, any>;

/* ----------------------------- Component ---------------------------------- */
const SchoolTab: React.FC = () => {
    // identity
    const currentUser = React.useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("currentUser") || "null");
        } catch {
            return null;
        }
    }, []);

    if (!currentUser?.email) {
        return <p>Please sign in.</p>;
    }

    const aKey = qaAnswersKey(currentUser.email);

    // answers state
    const [answers, setAnswers] = React.useState<Answers>(() =>
        readJSON<Answers>(aKey, {})
    );

    React.useEffect(() => {
        writeJSON(aKey, answers);
    }, [aKey, answers]);

    // Merge patches from EnterClasses import (meeting days/times) so UI updates immediately
    React.useEffect(() => {
        function onMerge(e: Event) {
            const ce = e as CustomEvent<{ patch: Record<string, any> }>;
            const patch = (ce.detail && (ce.detail as any).patch) || {};
            if (!patch || typeof patch !== "object") return;
            setAnswers((prev) => ({ ...prev, ...patch }));
        }
        window.addEventListener("qa:merge-answers", onMerge as EventListener);
        return () => window.removeEventListener("qa:merge-answers", onMerge as EventListener);
    }, []);

    

    // Rename alias modal state
    const [renameTarget, setRenameTarget] = React.useState<{ cls: string; input: string } | null>(null);
const setAnswer = (id: string, value: any) => {
        setAnswers((prev) => ({ ...prev, [id]: value }));
    };

    // convenience for meeting time object
    const getMeetingTime = (base: string): { start?: string; end?: string } =>
        (answers[`${base}_meeting_time`] as { start?: string; end?: string }) || {};
    const setMeetingTime = (base: string, part: "start" | "end", value: string) => {
        const cur = getMeetingTime(base);
        setAnswer(`${base}_meeting_time`, { ...cur, [part]: value });
    };

    // classes list from the general question
    const classes: string[] = Array.isArray(answers["school_classes"])
        ? (answers["school_classes"] as string[])
        : [];

    /* ------------------- GENERAL QUESTIONS (mirror questions.ts) ------------------- */
    const renderGeneralQuestion = (q: (typeof QUESTIONS)["school"]["questions"][number]) => {
        const value = answers[q.id];

        switch (q.type) {
            case "priority": {
                const v = typeof value === "number" ? value : (q.defaultValue as number) ?? 70;
                return (
                    <div className="profile-card input-mode" key={q.id}>
                        <p className="question-desc">{q.description}</p>
                        <PrioritySlider variant="bucket" value={v} onChange={(nv) => setAnswer(q.id, nv)} />
                    </div>
                );
            }
            case "number": {
                const v = value ?? "";
                return (
                    <div className="profile-card input-mode" key={q.id}>
                        <p className="question-desc">{q.description}</p>
                        <NumberInput value={String(v)} onChange={(nv) => setAnswer(q.id, nv)} placeholder={q.hint || "0"} />
                    </div>
                );
            }
            case "text": {
                const v = value ?? "";
                return (
                    <div className="profile-card input-mode" key={q.id}>
                        <p className="question-desc">{q.description}</p>
                        <TextInput value={String(v)} onChange={(nv) => setAnswer(q.id, nv)} placeholder={q.hint || ""} />
                    </div>
                );
            }
            case "time": {
                const v = value ?? "";
                return (
                    <div className="profile-card input-mode" key={q.id}>
                        <p className="question-desc">{q.description}</p>
                        <TimeInput value={String(v)} onChange={(nv) => setAnswer(q.id, nv)} />
                    </div>
                );
            }
            case "day-selection": {
                const v = (Array.isArray(value) ? value : []) as DayName[];
                return (
                    <div className="profile-card input-mode" key={q.id}>
                        <p className="question-desc">{q.description}</p>
                        <DaySelection value={v} onChange={(nv) => setAnswer(q.id, nv)} />
                    </div>
                );
            }
            case "time-selection": {
                const v = (Array.isArray(value) ? value : []) as TimeName[];
                return (
                    <div className="profile-card input-mode" key={q.id}>
                        <p className="question-desc">{q.description}</p>
                        <TimeOfDaySelection value={v} onChange={(nv) => setAnswer(q.id, nv)} />
                    </div>
                );
            }
            case "enter-classes": {
                const v = Array.isArray(value) ? (value as string[]) : [];
                return (
                    <div className="profile-card input-mode" key={q.id}>
                        <p className="question-desc">{q.description}</p>
                        <EnterClasses value={v} onChange={(nv) => setAnswer(q.id, nv)} />
                    </div>
                );
            }
            case "boolean": {
                const v = !!value;
                return (
                    <div className="profile-card input-mode" key={q.id}>
                        <p className="question-desc">{q.description}</p>
                        <label style={{ display: "inline-flex", gap: ".5rem", alignItems: "center" }}>
                            <input type="checkbox" checked={v} onChange={(e) => setAnswer(q.id, e.target.checked)} />
                            <span>{v ? "Yes" : "No"}</span>
                        </label>
                    </div>
                );
            }
            default:
                return (
                    <div className="profile-card input-mode" key={q.id}>
                        <p className="question-desc">{q.description}</p>
                        <em>Unsupported input type: {q.type}</em>
                    </div>
                );
        }
    };

    /* ----------------------- CLASS CARDS (collapsible, styled) ---------------------- */
    const renderClassCard = (cls: string) => {
        const base = `class_${slugify(cls || "")}`;
        const alias = (answers[`${base}_alias`] || "").toString().trim();
        const displayName = alias || cls;

        const priority: number =
            typeof answers[`${base}_priority`] === "number" ? answers[`${base}_priority`] : 70;

        const meetingDays = (Array.isArray(answers[`${base}_meeting_days`])
            ? answers[`${base}_meeting_days`]
            : []) as DayName[];

        const meetingTime = getMeetingTime(base);
        const startTime = meetingTime.start ?? "";
        const endTime = meetingTime.end ?? "";

        const studyHours = answers[`${base}_study_hours`] ?? "";
        const prefTimes = (Array.isArray(answers[`${base}_pref_times`])
            ? answers[`${base}_pref_times`]
            : []) as TimeName[];

        // summary preview labels
        const daysLabel = meetingDays.length ? meetingDays.map((d) => d.slice(0, 3)).join("·") : "Days?";
        const timeLabel = startTime && endTime ? `${startTime}–${endTime}` : "Time?";
        const studyLabel = studyHours ? `${studyHours}h/wk` : "Hours?";

        return (
            <details className="profile-accordion__item" key={cls || base}>
                <summary className="profile-accordion__summary">
          <span className="profile-accordion__chevron" aria-hidden>
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <polyline points="8,4 16,12 8,20" />
            </svg>
          </span>

                    <span className="class-summary-title">{displayName?.trim() ? displayName : "Unnamed class"}</span>
                    <button
                        type="button"
                        className="remove-btn-small"
                        style={{ marginLeft: 12 }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRenameTarget({ cls, input: alias }); }}
                        title="Rename how this class appears"
                    >
                        Rename
                    </button>

                    <span className="class-summary-meta" aria-label="Class overview">
            <span className="badge" title="Meeting days"><span className="dot" />{daysLabel}</span>
            <span className="badge" title="Meeting time"><span className="dot" />{timeLabel}</span>
            <span className="badge" title="Study hours"><span className="dot" />{studyLabel}</span>
            <span className="badge" title="Priority"><span className="dot" />{priority}%</span>
          </span>
                </summary>

                <div className="profile-accordion__body">
                    <div className="profile-grid">
                        {/* Priority */}
                        <div className="profile-card input-mode">
                            <p className="question-desc">Class priority</p>
                            <PrioritySlider
                                variant="bucket"
                                value={priority}
                                onChange={(nv) => setAnswer(`${base}_priority`, nv)}
                            />
                        </div>

                        {/* Meeting days */}
                        <div className="profile-card input-mode">
                            <p className="question-desc">Class meets (days)</p>
                            <DaySelection
                                value={meetingDays}
                                onChange={(nv) => setAnswer(`${base}_meeting_days`, nv)}
                            />
                        </div>

                        {/* Meeting time (start/end) */}
                        <div className="profile-card input-mode">
                            <p className="question-desc">Class meets (time)</p>
                            <div className="q-time-grid">
                                <div className="q-time-compact">
                                    <label style={{ display: "block", fontSize: ".9rem", opacity: 0.9, marginBottom: ".25rem" }}>
                                        Start
                                    </label>
                                    <TimeInput value={startTime} onChange={(nv) => setMeetingTime(base, "start", nv)} />
                                </div>
                                <div className="q-time-compact">
                                    <label style={{ display: "block", fontSize: ".9rem", opacity: 0.9, marginBottom: ".25rem" }}>
                                        End
                                    </label>
                                    <TimeInput value={endTime} onChange={(nv) => setMeetingTime(base, "end", nv)} />
                                </div>
                            </div>
                        </div>

                        {/* Weekly study hours */}
                        <div className="profile-card input-mode">
                            <p className="question-desc">Study hours per week</p>
                            <NumberInput
                                value={String(studyHours ?? "")}
                                onChange={(nv) => setAnswer(`${base}_study_hours`, nv)}
                                placeholder="e.g., 6"
                            />
                        </div>

                        {/* Preferred study times */}
                        <div className="profile-card input-mode">
                            <p className="question-desc">Preferred study times (select all that apply)</p>
                            <TimeOfDaySelection
                                value={prefTimes}
                                onChange={(nv) => setAnswer(`${base}_pref_times`, nv)}
                            />
                        </div>
                    </div>
                </div>
            </details>
        );
    };

    /* -------------------------------- Render -------------------------------- */
    return (
        <div className="profile-tab-pane">
            <h2>📚 School Preferences</h2>

            {/* GENERAL */}
            <h3 className="mt-4">General</h3>
            <div className="profile-grid">
                {(QUESTIONS.school?.questions ?? []).map((q) => renderGeneralQuestion(q))}
            </div>

            {/* PER-CLASS */}
            {classes.length > 0 && (
                <>
                    <h3 className="mt-6">Class-specific details</h3>
                    <div className="profile-accordion">
                        {classes.map((cls) => renderClassCard(cls))}
                    </div>

                    {renameTarget && (
                        <div className="modal-overlay" onClick={() => setRenameTarget(null)}>
                            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                                <h3>Rename Class Display</h3>
                                <p>Set how this class will appear in the app. This is an alias; it won’t change the original code.</p>
                                <input
                                    type="text"
                                    placeholder="e.g., Intro to Psychology"
                                    value={renameTarget.input}
                                    onChange={(e) => setRenameTarget({ ...renameTarget, input: e.target.value })}
                                    style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}
                                />
                                <div className="modal-actions">
                                    <button onClick={() => {
                                        const cls = renameTarget.cls;
                                        const base = `class_${slugify(cls)}`;
                                        const alias = (renameTarget.input || '').trim();
                                        const patch: Record<string, any> = { [`${base}_alias`]: alias || undefined };
                                        setAnswers((prev) => ({ ...prev, ...patch }));
                                        window.dispatchEvent(new CustomEvent('qa:merge-answers', { detail: { patch } }));
                                        setRenameTarget(null);
                                    }}>Save</button>
                                    <button onClick={() => {
                                        const cls = renameTarget.cls;
                                        const base = `class_${slugify(cls)}`;
                                        const patch: Record<string, any> = { [`${base}_alias`]: undefined };
                                        setAnswers((prev) => ({ ...prev, ...patch }));
                                        window.dispatchEvent(new CustomEvent('qa:merge-answers', { detail: { patch } }));
                                        setRenameTarget(null);
                                    }}>Clear</button>
                                    <button onClick={() => setRenameTarget(null)}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SchoolTab;

